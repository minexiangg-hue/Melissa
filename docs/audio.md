# Audio in Melissa

Kokoro TTS is an optional, self-hosted addition to the existing teacher. STT and microphone recording are not implemented yet. The default clean checkout still uses device speech without downloading model weights.

## Enable the voice

Follow [worker preparation and deployment](speech-worker.md) to install the isolated runtime and pinned model artifacts. The worker listens only on `127.0.0.1:3210`; do not expose it as a public service. Set matching private bearer tokens in the worker environment and Melissa's ignored environment file, then configure:

```dotenv
SPEECH_PROVIDER=kokoro
SPEECH_BASE_URL=http://127.0.0.1:3210
SPEECH_API_TOKEN=replace-with-at-least-32-random-characters
SPEECH_TIMEOUT_MS=90000
SPEECH_DAILY_REQUEST_LIMIT=100
SPEECH_GLOBAL_DAILY_REQUEST_LIMIT=500
```

Restart Melissa after changing server settings. `SPEECH_PROVIDER=device` restores the device-voice path. Neither mode changes `TEACHER_PROVIDER`; the current Codex teacher can remain in use.

The initial voice is Kokoro `af_heart` at speed `0.9`. Voice/model selection is deliberately controlled on the server. This release uses a preset model voice and does not accept voice-cloning samples. Voice quality should be auditioned on the actual lessons; no subjective quality or accent assessment is inferred from successful synthesis alone.

## Request lifecycle

A learner selects Listen on an assistant reply or a saved lesson passage. The shared player stops any other playback, divides long passages into exact substrings of at most 1,600 UTF-16 code units, and requests each passage in sequence. Stop/navigation cancels client work and releases media resources. If autoplay is blocked, the interface asks for a user playback gesture. If Kokoro fails, the user can explicitly choose the device voice where supported.

The API verifies the guest, origin, text ownership and limits before reserving one durable audio request. The Kokoro adapter bounds time and response size and validates complete mono, 24 kHz, 16-bit PCM WAV data, at most 180 seconds, before returning it. This release uses complete bounded audio responses; it does not claim streaming time-to-first-audio. Listening never resubmits the teacher, advances objectives or increments the learner revision.

Audio attempts use their own SQLite migration-3 table and UTC budgets. They do not consume the teacher request budget. Reserved failures consume audio allowance; duplicate request IDs are rejected. The app and worker reject excess concurrent work instead of building an unbounded queue. Cancellation stops delivery; the worker's own deadline remains the final bound on any computation already running.

No input text or generated audio is persisted in the speech ledger. It retains request identifiers, attempt status and character counts. Learner deletion/expiry strips identifying audio metadata while retaining anonymous current-day counts to prevent resetting global limits. Old completed/expired records are pruned. The client uses no persistent audio cache. Deletion cancels the current process's pending speech request, and completion also checks that the owner still exists and has not expired.

## STT recommendation, still unimplemented

Start evaluation with [faster-whisper](https://github.com/SYSTRAN/faster-whisper), a multilingual small model using CPU INT8. Measure accented English, incomplete learner sentences, silence, background noise, mixed English/Chinese and end-to-end latency on this server before selecting a production default. A separate service can later implement `SpeechToTextProvider` without changing lesson orchestration.

A paid [Deepgram Nova-3](https://developers.deepgram.com/docs/models-languages-overview/) adapter is an alternative. Sprout has reusable browser audio handling around Deepgram, but its full Voice Agent flow includes a separate cloud reasoning stage; it must not bypass Melissa's teacher and saved lesson state.

Browser [SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition) is a possible optional path. Support is not universal, and some implementations send recordings to an external recognition service. Browser-native does not guarantee offline operation. The proposed first UI is record, review/edit transcript, then send; transcript quality must not be presented as pronunciation scoring.

## Validation

Normal CI covers authenticated route behavior, owned passages, attempt budgets, concurrency, migration/deletion, transport validation/deadlines, and playback error/cancellation. Worker contract tests use a fake synthesizer without downloading weights. Real synthesis and browser playback checks require the prepared local worker and are recorded separately; they spend CPU time, not external API quota.
