"""Loopback-only authenticated WAV service. No prompt, audio or access logging."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import contextlib
import hmac
import json
import os
from pathlib import Path
import select
import signal
import socket
import sys
import threading

from .assets import DEFAULT_MODEL_DIR
from .contract import MAX_BODY_BYTES, MAX_INPUT_UNITS, SAMPLE_RATE, VOICE, SpeechError, parse_request
from .engine import EngineConfig, SpeechEngine


class SpeechServer(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 8

    def __init__(self, address, engine, token: str):
        self.engine = engine
        self.token = token
        self._http_slots = threading.BoundedSemaphore(8)
        super().__init__(address, SpeechHandler)

    def process_request(self, request, client_address):
        if not self._http_slots.acquire(blocking=False):
            with contextlib.suppress(OSError):
                request.sendall(b"HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\nContent-Length: 0\r\nRetry-After: 2\r\n\r\n")
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self._http_slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._http_slots.release()

    def handle_error(self, request, client_address):
        # Never print request details or exception messages from inference.
        pass


class SpeechHandler(BaseHTTPRequestHandler):
    server: SpeechServer
    protocol_version = "HTTP/1.1"
    server_version = "MelissaSpeech"
    sys_version = ""

    def setup(self):
        super().setup()
        self.connection.settimeout(5)

    def log_message(self, format, *args):
        pass

    def _respond(self, status: int, body: bytes, content_type: str, retry: bool = False):
        self.close_connection = True
        try:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Connection", "close")
            if retry:
                self.send_header("Retry-After", "2")
            self.end_headers()
            self.wfile.write(body)
        except OSError:
            pass

    def _json(self, status: int, value: dict, retry: bool = False):
        self._respond(status, json.dumps(value, separators=(",", ":")).encode("utf-8"), "application/json", retry)

    def _error(self, error: SpeechError):
        self._json(error.status, {"error": {"code": error.code, "message": error.message}}, error.code == "BUSY")

    def do_GET(self):
        if self.path != "/health":
            self._error(SpeechError("NOT_FOUND", "Speech endpoint not found.", 404))
            return
        ready = self.server.engine.ready
        self._json(200 if ready else 503, {
            "status": "ok" if ready else "unavailable",
            "engine": "kokoro-onnx",
            "version": "0.6.1",
            "voice": VOICE,
            "sampleRate": SAMPLE_RATE,
            "maxInputCharacters": MAX_INPUT_UNITS,
            "busy": self.server.engine.busy,
        })

    def _disconnected(self):
        try:
            readable, _, _ = select.select([self.connection], [], [], 0)
            return bool(readable) and not self.connection.recv(1, socket.MSG_PEEK)
        except OSError:
            return True

    def do_POST(self):
        if self.path != "/v1/audio/speech":
            self._error(SpeechError("NOT_FOUND", "Speech endpoint not found.", 404))
            return
        expected = f"Bearer {self.server.token}"
        supplied = self.headers.get("Authorization", "")
        if not hmac.compare_digest(supplied.encode("utf-8"), expected.encode("utf-8")):
            self._error(SpeechError("UNAUTHORIZED", "Speech service authentication is required.", 401))
            return
        try:
            if self.headers.get("Transfer-Encoding") or len(self.headers.get_all("Content-Length", [])) != 1:
                raise SpeechError("VALIDATION", "A single Content-Length is required.", 400)
            if self.headers.get_content_type() != "application/json":
                raise SpeechError("VALIDATION", "Use application/json for speech requests.", 400)
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1:
                raise SpeechError("VALIDATION", "A JSON request body is required.", 400)
            if length > MAX_BODY_BYTES:
                raise SpeechError("INPUT_LIMIT", "The speech request is too large.", 413)
            body = self.rfile.read(length)
            if len(body) != length:
                raise SpeechError("VALIDATION", "The speech request was incomplete.", 400)
            request = parse_request(body)
            audio = self.server.engine.synthesize(request, self._disconnected)
            self._respond(200, audio, "audio/wav")
        except SpeechError as error:
            self._error(error)
        except (ValueError, OSError):
            self._error(SpeechError("VALIDATION", "The speech request could not be read.", 400))
        except Exception:
            self._error(SpeechError("UNAVAILABLE", "Local speech is temporarily unavailable.", 503))


def bounded_env(name: str, default: float, minimum: float, maximum: float) -> float:
    value = float(os.environ.get(name, str(default)))
    if not minimum <= value <= maximum:
        raise ValueError(f"Invalid {name} configuration.")
    return value


def validate_token(token: str) -> str:
    if not 32 <= len(token) <= 256 or any(not "!" <= character <= "~" for character in token):
        raise ValueError("SPEECH_API_TOKEN must contain 32–256 printable ASCII characters without spaces.")
    return token


def main():
    token = validate_token(os.environ.get("SPEECH_API_TOKEN", ""))
    port = int(bounded_env("SPEECH_PORT", 3210, 1024, 65535))
    threads = int(bounded_env("SPEECH_THREADS", 2, 1, 4))
    config = EngineConfig(
        model_dir=Path(os.environ.get("SPEECH_MODEL_DIR", str(DEFAULT_MODEL_DIR))).resolve(),
        threads=threads,
        timeout=bounded_env("SPEECH_TIMEOUT_SECONDS", 90, 1, 180),
        startup_timeout=60,
    )
    engine = SpeechEngine(config)
    engine.start()
    server = SpeechServer(("127.0.0.1", port), engine, token)
    stopping = threading.Event()

    def stop(_signum, _frame):
        if not stopping.is_set():
            stopping.set()
            threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        print(f"Melissa local speech ready on 127.0.0.1:{port}", flush=True)
        server.serve_forever(poll_interval=0.2)
    finally:
        server.server_close()
        engine.close()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Melissa speech startup failed. Verify local assets and worker configuration.", file=sys.stderr)
        raise SystemExit(1) from None
