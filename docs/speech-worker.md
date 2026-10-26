# Local Kokoro speech

Melissa can prepare English speech locally with Kokoro v1.0 and the `af_heart` voice. The Next.js application sends text to a separate CPU worker over authenticated loopback HTTP. The browser receives a complete WAV through Melissa's own API; it never receives the worker token. Text generation remains independent of speech.

The worker uses `kokoro-onnx` 0.6.1 and ONNX Runtime 1.31.0, with two CPU inference threads by default. It needs neither a GPU nor a hosted inference account. Speech recognition is separate and is not implemented by this worker.

## Prepare an isolated installation

Run from the repository root. Python 3.12 was used for the measured installation. The setup commands require network access; the running worker does not.

```bash
python3 -m venv --without-pip .data/speech/venv
python3 -m pip --python .data/speech/venv install --index-url https://pypi.org/simple -r services/speech/requirements.txt
python3 -m services.speech.prepare
```

This uses an existing system pip only to install into the isolated virtual environment. It does not install or upgrade global packages. On hosts with `ensurepip`, a normal `python3 -m venv .data/speech/venv` followed by the environment's pip works too. The pinned requirements include the eSpeak shared library loader, so no system eSpeak installation is needed on the tested Linux x86-64 host.

Model assets live under `.data/speech/models/`; Python packages live under `.data/speech/venv/`. Both are ignored by Git. `prepare.py` checks the exact byte count and SHA-256 before replacing an asset. Startup verifies both files again and fails closed on a mismatch. To prepare another directory, use `python3 -m services.speech.prepare --help` and set the same `SPEECH_MODEL_DIR` for the worker.

## Artifact provenance and licenses

The ONNX model is the full precision English v1.0 export, downloaded from the upstream [kokoro-onnx model-files-v1.1 release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.1). The release tag describes the export bundle; the model itself is Kokoro v1.0. Hashes below match the release's GitHub asset digest and are pinned in `services/speech/assets.py`.

| Asset              |     Bytes | SHA-256                                                            |
| ------------------ | --------: | ------------------------------------------------------------------ |
| `kokoro-v1.0.onnx` | 325505369 | `beb0d1848dee9a49da392cc3df26958d46cfa35d321edf434f52949153f0df3a` |
| `voices-v1.0.bin`  |  28214398 | `bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d` |

Direct artifacts: [model](https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx), [voices](https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin).

The original [Kokoro model card](https://huggingface.co/hexgrad/Kokoro-82M) declares Apache-2.0 weights and documents the training-data attributions; its [voice reference](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) describes `af_heart`. The [kokoro-onnx wrapper](https://github.com/thewh1teagle/kokoro-onnx/blob/main/LICENSE) and [espeakng-loader wrapper](https://github.com/thewh1teagle/espeakng-loader/blob/main/LICENSE) use MIT. The runtime also includes [phonemizer under GPLv3](https://github.com/bootphon/phonemizer/blob/master/LICENSE) and the bundled [eSpeak NG engine under GPLv3](https://github.com/espeak-ng/espeak-ng/blob/master/COPYING). The complete runtime is therefore not exclusively MIT/Apache licensed. Preserve the upstream licenses and source notices when distributing an image or dependency bundle; model and package files are downloaded during setup, not vendored into this repository. Other dependency notices remain in the installed distributions.

## Configure and run

Create a private `.env.speech` with mode `0600`. Use one securely generated secret in both the worker and Next.js environment; do not put it in a `NEXT_PUBLIC_*` variable or commit it. Tokens must contain 32–256 printable ASCII characters without spaces. A 32-byte random token encoded as 64 hexadecimal characters satisfies the contract.

```dotenv
SPEECH_API_TOKEN=<shared random token>
SPEECH_PORT=3210
SPEECH_THREADS=2
SPEECH_TIMEOUT_SECONDS=90
# Optional absolute path; default is <repository>/.data/speech/models
# SPEECH_MODEL_DIR=/absolute/path/to/prepared/models
```

Load these settings into the process environment, then run:

```bash
PYTHONDONTWRITEBYTECODE=1 .data/speech/venv/bin/python -m services.speech.worker
```

The worker always binds `127.0.0.1`. Keep port 3210 private; only the main application needs a public port. Configure the main application with the same token and:

```dotenv
SPEECH_PROVIDER=kokoro
SPEECH_BASE_URL=http://127.0.0.1:3210
SPEECH_TIMEOUT_MS=90000
```

The main application's speech quotas and guest authorization still apply. Use `SPEECH_PROVIDER=device` to select the existing browser speech path without running this worker.

`SPEECH_THREADS` accepts 1–4; `SPEECH_TIMEOUT_SECONDS` accepts 1–180 seconds, with 90 seconds matching the main application's default maximum. Production port values must be in 1024–65535. Keep the application timeout at least as large as the chosen worker deadline; client cancellation also terminates inference. A model load after cancellation is included in the next request's deadline.

## API contract

`GET /health` needs no token and returns readiness plus `busy`; it does not trigger inference. Status is 200 when the model process is ready, otherwise 503. Normal response:

```json
{
  "status": "ok",
  "engine": "kokoro-onnx",
  "version": "0.6.1",
  "voice": "af_heart",
  "sampleRate": 24000,
  "maxInputCharacters": 1600,
  "busy": false
}
```

`POST /v1/audio/speech` requires `Authorization: Bearer <token>`, `Content-Type: application/json`, and one explicit `Content-Length`. Chunked requests are rejected. Body:

```json
{
  "input": "Welcome back. Let us practise one useful phrase today.",
  "voice": "af_heart",
  "speed": 0.9
}
```

`input` is required; `voice` and `speed` default to the values above. Unknown keys are rejected. Only `af_heart` is enabled, and speed must be a finite number between 0.5 and 1.5. Input is limited to 1,600 UTF-16 code units, matching JavaScript string length, before surrounding whitespace is trimmed. Empty input, lone surrogate code points and control characters other than newline/tab are rejected. The JSON body is limited to 16 KiB.

A successful response has `Content-Type: audio/wav`, an exact `Content-Length`, and `Cache-Control: no-store`. Audio is complete RIFF/WAV PCM, mono, 24,000 Hz, signed 16-bit little-endian. Duration is capped at 180 seconds and total bytes at 9 MiB; either violation returns an error rather than truncated audio.

Errors use `{"error":{"code":"...","message":"..."}}` with sanitized messages:

| HTTP | Code           | Meaning                                                  |
| ---- | -------------- | -------------------------------------------------------- |
| 400  | `VALIDATION`   | Malformed body, unsupported input/voice/speed or framing |
| 401  | `UNAUTHORIZED` | Missing or incorrect bearer token                        |
| 404  | `NOT_FOUND`    | Unknown endpoint                                         |
| 413  | `INPUT_LIMIT`  | Input or JSON body too large                             |
| 413  | `OUTPUT_LIMIT` | Generated audio exceeds the duration or byte bound       |
| 429  | `BUSY`         | Another synthesis is active; `Retry-After: 2`            |
| 503  | `TIMEOUT`      | The synthesis deadline expired                           |
| 503  | `CANCELLED`    | The caller disconnected; normally no response reaches it |
| 503  | `UNAVAILABLE`  | Model load, process or synthesis failure                 |

There is one persistent inference process and no inference queue. A nonblocking gate rejects concurrent synthesis. HTTP handling is separately bounded to eight connections; saturation returns a small 503 response with `Retry-After: 2`. Health checks remain cheap. Timeout, caller disconnect or engine failure terminates the child process; a subsequent request can load a fresh instance. The complete output stays in memory, and requests, audio and access logs are never saved by this worker. A Python audit hook denies network connections in the inference child, and the production service additionally blocks non-loopback IP traffic.

## Production service

`deploy/melissa-speech.service` is the systemd template for this server's `ubuntu` user and current repository path. Adjust those paths if deploying elsewhere. It runs the isolated interpreter with the private environment file, two CPUs, a 2 GiB memory ceiling, 32 tasks, a read-only filesystem/home and no non-loopback network access. Packages and assets must already exist before service startup; it does not download or install anything.

Install the reviewed unit through the deployment process, then reload systemd and enable/start `melissa-speech.service`. Stop any manually launched worker on 3210 before starting the service. Verify `http://127.0.0.1:3210/health` and one authenticated synthesis after installation.

If the main application should start speech automatically, its systemd unit should use `Wants=melissa-speech.service` and `After=melissa-speech.service`. Avoid `Requires=`: text teaching should continue when speech is unavailable. Ordering is not a readiness guarantee, so the application must handle 503 responses during warm-up. Keep the same `SPEECH_API_TOKEN` in both environment files. A worker restart does not require a main application restart unless its speech configuration changed.

## Verification and measured performance

Credential-free, model-free CI tests use only Python's standard library:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s services/speech/tests -v
```

The nine tests cover UTF-16 boundaries, malformed inputs, token validation, authenticated WAV responses, busy rejection, hard timeout/process termination, cancellation, and recovery. To benchmark actual prepared weights without storing text or audio:

```bash
PYTHONDONTWRITEBYTECODE=1 .data/speech/venv/bin/python -m services.speech.benchmark
```

Measured on the existing Linux x86-64 server on 2026-10-26: four logical CPUs, approximately 15.2 GiB RAM, CPU-only, two inference threads, full precision model, `af_heart`, speed 0.9. Cold load including digest verification took 1.652 seconds; the loaded inference process used approximately 449 MiB RSS.

| Fixture       | Characters | Synthesis | Audio duration | WAV bytes | Real-time factor |
| ------------- | ---------: | --------: | -------------: | --------: | ---------------: |
| Short phrase  |         76 |   2.260 s |        4.829 s |    231852 |            0.468 |
| Teacher reply |        275 |   8.112 s |       17.343 s |    832522 |            0.468 |
| Long passage  |       1204 |  34.479 s |       77.374 s |   3713996 |            0.446 |

All three outputs were parsed and verified as complete 24 kHz, mono, 16-bit WAV. These measurements validate execution, format and latency; they are not a listening-quality evaluation. Playback waits for the complete WAV, so the teacher-reply fixture has roughly eight seconds of preparation latency on this host. Sentence streaming, additional voices and pronunciation assessment remain separate future extensions.
