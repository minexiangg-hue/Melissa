"""One persistent CPU process; hard deadlines and no inference queue."""
from dataclasses import dataclass
import contextlib
import hashlib
import io
import logging
import multiprocessing
from multiprocessing.connection import Connection
import os
from pathlib import Path
import sys
import threading
import time
import wave
from collections.abc import Callable

from .assets import ASSETS, MODEL_FILE, VOICES_FILE
from .contract import MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS, SAMPLE_RATE, VOICE, SpeechError, SpeechRequest


@dataclass(frozen=True)
class EngineConfig:
    model_dir: Path
    threads: int = 2
    timeout: float = 90
    startup_timeout: float = 60


def _deny_network(event: str, _arguments: tuple) -> None:
    if event in {"socket.connect", "socket.getaddrinfo"}:
        raise PermissionError("Speech inference does not use network connections.")


def _load(config: EngineConfig):
    for name, metadata in ASSETS.items():
        path = config.model_dir / name
        if path.stat().st_size != metadata["bytes"]:
            raise ValueError("Speech model size mismatch.")
        with path.open("rb") as source:
            if hashlib.file_digest(source, "sha256").hexdigest() != metadata["sha256"]:
                raise ValueError("Speech model digest mismatch.")
    import onnxruntime as ort
    from kokoro_onnx import Kokoro

    options = ort.SessionOptions()
    options.intra_op_num_threads = config.threads
    options.inter_op_num_threads = 1
    options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    options.log_severity_level = 4
    session = ort.InferenceSession(str(config.model_dir / MODEL_FILE), sess_options=options, providers=["CPUExecutionProvider"])
    model = Kokoro.from_session(session, str(config.model_dir / VOICES_FILE))
    if VOICE not in model.get_voices():
        raise ValueError("The configured voice is unavailable.")
    return model


def encode_audio(samples, rate: int) -> bytes:
    import numpy as np

    audio = np.asarray(samples)
    if rate != SAMPLE_RATE or audio.ndim != 1 or not audio.size or not np.isfinite(audio).all():
        raise ValueError("Invalid audio result.")
    if audio.size > SAMPLE_RATE * MAX_AUDIO_SECONDS:
        raise OverflowError("Audio duration exceeded the limit.")
    pcm = (np.clip(audio, -1, 1) * 32767).round().astype("<i2").tobytes()
    target = io.BytesIO()
    with wave.open(target, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm)
    result = target.getvalue()
    if len(result) > MAX_AUDIO_BYTES:
        raise OverflowError("Audio bytes exceeded the limit.")
    return result


def _run_engine(channel: Connection, config: EngineConfig) -> None:
    # Third-party debug/errors can include input text. Never forward them to journals.
    os.environ["OMP_NUM_THREADS"] = str(config.threads)
    os.environ["OPENBLAS_NUM_THREADS"] = "1"
    os.environ["MKL_NUM_THREADS"] = "1"
    logging.disable(logging.CRITICAL)
    sys.addaudithook(_deny_network)
    with open(os.devnull, "w") as quiet, contextlib.redirect_stdout(quiet), contextlib.redirect_stderr(quiet):
        try:
            model = _load(config)
            channel.send_bytes(b"READY")
            while True:
                request = channel.recv()
                if request is None:
                    break
                try:
                    audio, rate = model.create(request.input, voice=request.voice, speed=request.speed, lang="en-us")
                    channel.send_bytes(b"A" + encode_audio(audio, rate))
                except OverflowError:
                    channel.send_bytes(b"L")
                except Exception:
                    channel.send_bytes(b"E")
        except (EOFError, BrokenPipeError):
            pass
        except Exception:
            with contextlib.suppress(Exception):
                channel.send_bytes(b"E")
        finally:
            channel.close()


class SpeechEngine:
    def __init__(self, config: EngineConfig, target: Callable = _run_engine):
        self.config = config
        self._target = target
        self._gate = threading.Lock()
        self._process = None
        self._channel = None
        self._ready = False

    @property
    def ready(self) -> bool:
        process = self._process
        try:
            return bool(self._ready and process is not None and process.is_alive())
        except (AssertionError, ValueError):
            # Health requests may race a timeout that closes the old process.
            return False

    @property
    def busy(self) -> bool:
        return self._gate.locked()

    def _stop(self) -> None:
        self._ready = False
        if self._channel is not None:
            self._channel.close()
            self._channel = None
        if self._process is not None:
            if self._process.is_alive():
                self._process.terminate()
            self._process.join(timeout=2)
            if self._process.is_alive():
                self._process.kill()
                self._process.join(timeout=2)
            self._process.close()
            self._process = None

    def _receive(self, deadline: float, cancelled: Callable[[], bool] | None = None) -> bytes:
        while True:
            if cancelled is not None and cancelled():
                raise SpeechError("CANCELLED", "Speech playback was cancelled.", 503)
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise SpeechError("TIMEOUT", "Speech preparation took too long. Please try a shorter passage.", 503)
            if self._channel.poll(min(remaining, 0.1)):
                return self._channel.recv_bytes(MAX_AUDIO_BYTES + 1)
            if not self._process.is_alive():
                raise SpeechError("UNAVAILABLE", "Local speech is temporarily unavailable.", 503)

    def _start(self, deadline: float) -> None:
        self._stop()
        context = multiprocessing.get_context("spawn")
        parent, child = context.Pipe()
        self._channel = parent
        self._process = context.Process(target=self._target, args=(child, self.config), daemon=True)
        self._process.start()
        child.close()
        if self._receive(deadline) != b"READY":
            raise SpeechError("UNAVAILABLE", "Local speech could not load its prepared model.", 503)
        self._ready = True

    def start(self) -> None:
        with self._gate:
            try:
                self._start(time.monotonic() + self.config.startup_timeout)
            except Exception:
                self._stop()
                raise

    def synthesize(self, request: SpeechRequest, cancelled: Callable[[], bool] | None = None) -> bytes:
        if not self._gate.acquire(blocking=False):
            raise SpeechError("BUSY", "Melissa is preparing another voice response. Please try again shortly.", 429)
        deadline = time.monotonic() + self.config.timeout
        try:
            if not self.ready:
                self._start(deadline)
            self._channel.send(request)
            result = self._receive(deadline, cancelled)
            if result[:1] == b"A":
                return result[1:]
            if result == b"L":
                raise SpeechError("OUTPUT_LIMIT", "This passage would produce too much audio. Please choose a shorter passage.", 413)
            raise SpeechError("UNAVAILABLE", "Local speech could not prepare this passage.", 503)
        except SpeechError as error:
            if error.code in {"TIMEOUT", "CANCELLED", "UNAVAILABLE"}:
                self._stop()
            raise
        except Exception:
            self._stop()
            raise SpeechError("UNAVAILABLE", "Local speech is temporarily unavailable.", 503) from None
        finally:
            self._gate.release()

    def close(self) -> None:
        with self._gate:
            self._stop()
