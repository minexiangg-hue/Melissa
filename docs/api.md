# API v1

Default API prefix: `/api/v1`. With `NEXT_PUBLIC_BASE_PATH=/melissa`, the browser prefix is `/melissa/api/v1`; the endpoint paths below are relative to that prefix. `APP_ORIGIN` remains the origin without a path, such as `https://hermoscare.com`. JSON request bodies use `Content-Type: application/json`. Browser clients send credentials automatically. Every mutation also requires `Origin` equal to `APP_ORIGIN`, including bootstrap. Application API responses use `Cache-Control: no-store` and an `X-Request-Id` correlation ID; the deployment proxy can also return bounded JSON errors before a request reaches the application.

The cookie, not a client-supplied user ID, determines ownership. Session IDs are unguessable UUIDs but are still checked against the current learner's stored sessions.

| Method | Path                     | Body                                                                | Response                                           |
| ------ | ------------------------ | ------------------------------------------------------------------- | -------------------------------------------------- |
| GET    | `/health`                | None                                                                | `{ "status": "ok", "mode": "demo                   | codex | openai-compatible" }` |
| POST   | `/bootstrap`             | `{}`                                                                | Snapshot; sets a guest cookie if absent or expired |
| GET    | `/state`                 | None                                                                | Current snapshot                                   |
| PUT    | `/profile`               | `{ "revision": 0, "profile": { ... } }`                             | Updated snapshot                                   |
| POST   | `/sessions`              | `{ "revision": 1, "lessonId": "everyday-b1" }`                      | Snapshot, HTTP 201                                 |
| POST   | `/sessions/:id/messages` | `{ "revision": 2, "requestId": "<uuid>", "text": "Hi, I am Mei." }` | Updated snapshot                                   |
| POST   | `/sessions/:id/finish`   | `{ "revision": 3 }`                                                 | Updated snapshot                                   |
| DELETE | `/data`                  | `{ "revision": 4 }`                                                 | `{ "deleted": true }`; clears guest cookie         |

`Snapshot` is defined in `src/domain/models.ts`: state (including saved materials), available starter lessons, capabilities, knowledge source/suggestion metadata, `aiUsage` (or null in demo), and the daily demo limit. `aiUsage` includes requests/limit, reported input/output tokens, and unknown-usage attempt count. The health mode identifies the configured adapter; it does not claim a continuous upstream health check. Obtain revisions from the latest snapshot. A successful state mutation increments the revision once.

## Personal materials

`POST /materials` accepts:

```json
{
  "revision": 1,
  "requestId": "<uuid>",
  "goal": "work",
  "topic": "Explaining a delayed project"
}
```

`topic` is optional (defaults to an empty string) and is limited to 120 trimmed characters. Goal is required; level comes from the saved learner profile. The response is an updated snapshot with HTTP 201. A material includes reading, dialogue, vocabulary, multiple-choice exercises with answer explanations, three conversational objectives, source IDs, provider kind and creation metadata. `requestedTopic` preserves the replay input; `topic` records the resolved subject. Up to 30 generated lessons are retained per guest.

Start a saved material using its `material-<uuid>` ID in `POST /sessions`. The session copies its content and level, so later profile changes do not rewrite the lesson. All generated material IDs are resolved inside the authenticated guest's data. Library material and source metadata are included in snapshot export; no extra public material endpoint exists.

Successful duplicate material requests return the current snapshot without a new generation. Reusing that ID for a different topic or goal returns 409. Input is data for the curriculum writer, never instructions controlling tools or persistence.

## Profile

```json
{
  "displayName": "Mei",
  "nativeLanguage": "Chinese",
  "level": "B1",
  "goal": "everyday",
  "dailyMinutes": 10
}
```

Display names: 1–40 trimmed characters. First language: `Chinese`, `English`, or `Other`. Level: `A1` through `C2`. Goal: `everyday`, `travel`, or `work`. Daily minutes: `5`, `10`, or `15`. The level is self-reported. No hidden assessment is performed.

## Retries and conflicts

Generate one `requestId` per submitted text and reuse it when retrying that same text. Successful duplicate message requests return the **current** snapshot without appending or charging again, including after session completion. Reusing the same request ID for different text returns 409.

For network-response loss, retain the same request ID. If the server explicitly returns `RETRY_REQUIRED` (503), the prior attempt is final and still counts toward the AI allowance: keep the draft and generate a new ID for the next user-triggered attempt. Do not retry automatically.

A stale revision returns 409. Fetch `/state`, preserve the user's draft, and retry only after reconciling with the current state. The web client does this automatically on conflicts. Concurrent identical submissions may initially produce a 409 before a subsequent retry sees the committed receipt.

Starting the same already-active lesson with the current revision returns that active snapshot. Starting a different lesson while a session is active returns 409. Repeating finish on an already-completed owned session returns the current snapshot.

## Errors

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Your practice changed in another tab. Refresh and try again.",
    "requestId": "correlation-uuid"
  }
}
```

Validation errors additionally contain `fields`, a list of field paths. Raw submitted values are never echoed in errors.

| Status | Meaning                                                                               |
| ------ | ------------------------------------------------------------------------------------- |
| 400    | Malformed/missing JSON                                                                |
| 401    | Guest cookie absent, invalid, or expired                                              |
| 403    | Disallowed request origin                                                             |
| 404    | Endpoint, owned session, or available lesson not found                                |
| 409    | Stale revision, incompatible session transition, or reused request ID                 |
| 413    | Request body over 16 KiB                                                              |
| 415    | Non-JSON content type                                                                 |
| 422    | Invalid fields or blocked control delimiters                                          |
| 429    | Demo/AI daily allowance, 40-turn session, 100-session or 30-material storage limit    |
| 503    | Provider timeout, invalid output, unavailability or RETRY_REQUIRED; no turn committed |
| 500    | Unexpected internal error; use the request ID to correlate safe server logs           |

Transcription remains unimplemented. A request to an unimplemented endpoint returns 404 instead of a simulated transcript.

## Speech synthesis

`POST /api/v1/speech/synthesis` accepts strict JSON `{ "requestId": "UUID", "text": "saved passage" }`. A valid guest cookie and exact Origin are required. The text must be an exact substring of an assistant reply or the current guest's saved lesson reading/dialogue; arbitrary synthesis is rejected. Each passage is limited to 1,600 UTF-16 code units and 8 KiB. The client splits long readings without rewriting their text.

When `SPEECH_PROVIDER=kokoro`, success returns `audio/wav`, `Cache-Control: no-store` and `X-Speech-Provider: kokoro`. The WAV is complete and validated before the response starts. No learner revision changes. `capabilities.textToSpeech` signals the configured server integration; it is not a live worker readiness probe. `speechToText` remains false.

The audio budget defaults to 100 attempted generations per guest/day and 500 globally/day (UTC), with one active synthesis across the app database. Busy capacity detected by the app ledger is rejected before reservation; a later worker failure or busy response still consumes the reserved attempt. Failed reserved attempts consume allowance. A request ID can only be attempted once while retained; selecting Listen again starts an explicit new request. There is no hidden automatic retry or durable audio cache. Responses use the existing JSON error format for invalid text, unavailable voice, quota, identity and origin failures.
