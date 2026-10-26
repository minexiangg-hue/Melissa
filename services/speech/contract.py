"""HTTP-independent request and audio limits; usable in tests without model dependencies."""
from dataclasses import dataclass
import json
import math
import re

SAMPLE_RATE = 24000
MAX_INPUT_UNITS = 1600
MAX_BODY_BYTES = 16 * 1024
MAX_AUDIO_SECONDS = 180
MAX_AUDIO_BYTES = 9 * 1024 * 1024
VOICE = "af_heart"


class SpeechError(Exception):
    def __init__(self, code: str, message: str, status: int):
        super().__init__(message)
        self.code, self.message, self.status = code, message, status


@dataclass(frozen=True)
class SpeechRequest:
    input: str
    voice: str = VOICE
    speed: float = 0.9


def invalid() -> SpeechError:
    return SpeechError("VALIDATION", "Provide English text, the af_heart voice, and a speed from 0.5 to 1.5.", 400)


def parse_request(body: bytes) -> SpeechRequest:
    if len(body) > MAX_BODY_BYTES:
        raise SpeechError("INPUT_LIMIT", "The speech request is too large.", 413)
    try:
        value = json.loads(body.decode("utf-8"), parse_constant=lambda _: None)
        if not isinstance(value, dict) or not set(value).issubset({"input", "voice", "speed"}):
            raise invalid()
        text = value.get("input")
        voice = value.get("voice", VOICE)
        speed = value.get("speed", 0.9)
        if not isinstance(text, str) or not text.strip() or re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", text):
            raise invalid()
        units = len(text.encode("utf-16-le")) // 2
        if units > MAX_INPUT_UNITS:
            raise SpeechError("INPUT_LIMIT", "Read aloud supports up to 1600 characters at a time.", 413)
        if voice != VOICE or type(speed) not in (int, float) or not math.isfinite(speed) or not 0.5 <= speed <= 1.5:
            raise invalid()
        return SpeechRequest(text.strip(), voice, float(speed))
    except (UnicodeError, ValueError, TypeError):
        raise invalid() from None
