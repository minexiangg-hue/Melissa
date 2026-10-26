import http.client
import io
import json
import os
from pathlib import Path
import threading
import time
import unittest
import wave

from services.speech.contract import MAX_INPUT_UNITS, SAMPLE_RATE, SpeechError, SpeechRequest, parse_request
from services.speech.engine import EngineConfig, SpeechEngine
from services.speech.worker import SpeechServer, validate_token

TOKEN = "test-only-token-" + "x" * 40


def wav():
    target = io.BytesIO()
    with wave.open(target, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(b"\0\0" * 240)
    return target.getvalue()


def fake_engine(channel, _config):
    channel.send_bytes(b"READY")
    while True:
        try:
            request = channel.recv()
        except EOFError:
            break
        if request is None:
            break
        if request.input == "block":
            time.sleep(10)
        elif request.input == "slow":
            time.sleep(0.25)
        if request.input == "limit":
            channel.send_bytes(b"L")
        elif request.input == "failure":
            channel.send_bytes(b"E")
        else:
            channel.send_bytes(b"A" + wav())


class ContractTests(unittest.TestCase):
    def parse(self, value):
        return parse_request(json.dumps(value).encode())

    def test_token_accepts_printable_ascii_only_and_bounded_length(self):
        self.assertEqual(validate_token("!" * 32), "!" * 32)
        self.assertEqual(validate_token("~" * 256), "~" * 256)
        for value in ["x" * 31, "x" * 257, "x" * 31 + " ", "x" * 31 + "\x00", "x" * 31 + "\x7f", "x" * 31 + "é", "x" * 31 + "\n"]:
            with self.subTest(value=repr(value)), self.assertRaises(ValueError):
                validate_token(value)

    def test_default_voice_speed_and_exact_utf16_limit(self):
        self.assertEqual(self.parse({"input": " Hello "}), SpeechRequest("Hello"))
        self.assertEqual(len(self.parse({"input": "a" * MAX_INPUT_UNITS}).input), MAX_INPUT_UNITS)
        self.parse({"input": "🪷" * 800})
        with self.assertRaises(SpeechError) as caught:
            self.parse({"input": "🪷" * 801})
        self.assertEqual((caught.exception.status, caught.exception.code), (413, "INPUT_LIMIT"))

    def test_invalid_types_values_unknown_fields_and_control_bytes(self):
        for value in [[], {}, {"input": " "}, {"input": "x", "voice": "other"}, {"input": "x", "speed": True}, {"input": "x", "speed": 0.49}, {"input": "x", "speed": 1.51}, {"input": "x", "speed": float("nan")}, {"input": "x", "url": "https://example.com"}, {"input": "\ud800"}, {"input": "x\x00"}]:
            with self.subTest(value=repr(value)), self.assertRaises(SpeechError):
                self.parse(value)
        with self.assertRaises(SpeechError):
            parse_request(b"\xff")


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.engine = SpeechEngine(EngineConfig(Path("/unused"), timeout=0.7, startup_timeout=5), target=fake_engine)
        self.engine.start()

    def tearDown(self):
        self.engine.close()

    def test_rejects_concurrent_inference_without_queueing(self):
        results = []
        thread = threading.Thread(target=lambda: results.append(self.engine.synthesize(SpeechRequest("slow"))))
        thread.start()
        deadline = time.monotonic() + 1
        while not self.engine.busy and time.monotonic() < deadline:
            time.sleep(0.005)
        started = time.monotonic()
        with self.assertRaises(SpeechError) as caught:
            self.engine.synthesize(SpeechRequest("other"))
        self.assertEqual(caught.exception.code, "BUSY")
        self.assertLess(time.monotonic() - started, 0.1)
        thread.join(2)
        self.assertEqual(results, [wav()])

    def test_timeout_kills_inference_and_next_request_recovers(self):
        pid = self.engine._process.pid
        with self.assertRaises(SpeechError) as caught:
            self.engine.synthesize(SpeechRequest("block"))
        self.assertEqual(caught.exception.code, "TIMEOUT")
        self.assertFalse(self.engine.ready)
        with self.assertRaises(ProcessLookupError):
            os.kill(pid, 0)
        self.assertEqual(self.engine.synthesize(SpeechRequest("hello")), wav())
        self.assertTrue(self.engine.ready)

    def test_disconnect_kills_work_and_failed_audio_never_returns(self):
        with self.assertRaises(SpeechError) as caught:
            self.engine.synthesize(SpeechRequest("block"), cancelled=lambda: True)
        self.assertEqual(caught.exception.code, "CANCELLED")
        with self.assertRaises(SpeechError) as caught:
            self.engine.synthesize(SpeechRequest("limit"))
        self.assertEqual(caught.exception.code, "OUTPUT_LIMIT")
        with self.assertRaises(SpeechError) as caught:
            self.engine.synthesize(SpeechRequest("failure"))
        self.assertEqual(caught.exception.code, "UNAVAILABLE")


class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = SpeechEngine(EngineConfig(Path("/unused"), timeout=2, startup_timeout=5), target=fake_engine)
        cls.engine.start()
        cls.server = SpeechServer(("127.0.0.1", 0), cls.engine, TOKEN)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.engine.close()
        cls.thread.join(2)

    def call(self, method, path, body=None, token=TOKEN, extra=None):
        connection = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=4)
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
        headers.update(extra or {})
        connection.request(method, path, body=body, headers=headers)
        response = connection.getresponse()
        result = response.status, dict(response.getheaders()), response.read()
        connection.close()
        return result

    def test_health_and_authenticated_complete_wav(self):
        status, _, body = self.call("GET", "/health")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body)["engine"], "kokoro-onnx")
        status, headers, body = self.call("POST", "/v1/audio/speech", b'{"input":"Hello"}')
        self.assertEqual(status, 200)
        self.assertEqual(headers["Content-Type"], "audio/wav")
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertEqual(int(headers["Content-Length"]), len(body))
        with wave.open(io.BytesIO(body), "rb") as sound:
            self.assertEqual((sound.getnchannels(), sound.getsampwidth(), sound.getframerate()), (1, 2, 24000))

    def test_authentication_validation_content_type_and_input_limit(self):
        self.assertEqual(self.call("POST", "/v1/audio/speech", b'{"input":"Hello"}', token="bad")[0], 401)
        self.assertEqual(self.call("POST", "/v1/audio/speech", b'{}')[0], 400)
        self.assertEqual(self.call("POST", "/v1/audio/speech", b'{"input":"Hello"}', extra={"Content-Type": "text/plain"})[0], 400)
        status, _, body = self.call("POST", "/v1/audio/speech", json.dumps({"input": "a" * 1601}))
        self.assertEqual(status, 413)
        self.assertEqual(json.loads(body)["error"]["code"], "INPUT_LIMIT")
        self.assertEqual(self.call("GET", "/other")[0], 404)

    def test_http_busy_has_retry_after(self):
        self.engine._gate.acquire()
        try:
            status, headers, body = self.call("POST", "/v1/audio/speech", b'{"input":"Hello"}')
        finally:
            self.engine._gate.release()
        self.assertEqual(status, 429)
        self.assertEqual(headers["Retry-After"], "2")
        self.assertEqual(json.loads(body)["error"]["code"], "BUSY")


if __name__ == "__main__":
    unittest.main()
