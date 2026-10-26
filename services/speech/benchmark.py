"""Synthesize fixed, nonprivate fixtures in memory; report timings without saving audio."""
import io
import json
import time
import wave

from .assets import DEFAULT_MODEL_DIR
from .contract import SpeechRequest
from .engine import EngineConfig, SpeechEngine


def main():
    engine = SpeechEngine(EngineConfig(DEFAULT_MODEL_DIR))
    started = time.perf_counter()
    engine.start()
    print(json.dumps({"event": "model_loaded", "seconds": round(time.perf_counter() - started, 3)}), flush=True)
    fixtures = [
        ("short", "Hello, I'm Melissa. Take your time. What would you like to talk about today?"),
        ("teacher_reply", "That is a clear way to introduce yourself. A slightly more natural phrase is, I work on the design team. The words work on help us describe a project or a team. Now imagine that I am your new colleague. What are you working on this week, and what kind of help would you like?"),
        ("long", "Learning a language becomes easier when you practise a little every day. You do not need a perfect sentence to begin a useful conversation. Choose a familiar situation, try one small idea, and listen to the reply. If a word is new, ask the other person to explain it. Then use it in your own example. " * 4),
    ]
    try:
        for name, text in fixtures:
            start = time.perf_counter()
            audio = engine.synthesize(SpeechRequest(text))
            elapsed = time.perf_counter() - start
            with wave.open(io.BytesIO(audio), "rb") as sound:
                duration = sound.getnframes() / sound.getframerate()
                details = {"sampleRate": sound.getframerate(), "channels": sound.getnchannels(), "sampleBytes": sound.getsampwidth()}
            print(json.dumps({"fixture": name, "characters": len(text), "seconds": round(elapsed, 3), "audioSeconds": round(duration, 3), "realTimeFactor": round(elapsed / duration, 3), "wavBytes": len(audio), **details}), flush=True)
    finally:
        engine.close()


if __name__ == "__main__":
    main()
