# API v1

Default API prefix: `/api/v1`. With `NEXT_PUBLIC_BASE_PATH=/melissa`, the browser prefix is `/melissa/api/v1`; the endpoint paths below are relative to that prefix. `APP_ORIGIN` remains the origin without a path, such as `https://hermoscare.com`. JSON request bodies use `Content-Type: application/json`. Browser clients send credentials automatically. Every mutation also requires `Origin` equal to `APP_ORIGIN`, including bootstrap. Application API responses use `Cache-Control: no-store` and an `X-Request-Id` correlation ID; the deployment proxy can also return bounded JSON errors before a request reaches the application.

The cookie, not a client-supplied user ID, determines ownership. Session IDs are unguessable UUIDs but are still checked against the current learner's stored sessions.

| Method | Path                     | Body                                                                | Response                                           |
| ------ | ------------------------ | ------------------------------------------------------------------- | -------------------------------------------------- |
| GET    | `/health`                | None                                                                | `{ "status": "ok", "mode": "demo" }`               |
| POST   | `/bootstrap`             | `{}`                                                                | Snapshot; sets a guest cookie if absent or expired |
| GET    | `/state`                 | None                                                                | Current snapshot                                   |
| PUT    | `/profile`               | `{ "revision": 0, "profile": { ... } }`                             | Updated snapshot                                   |
| POST   | `/sessions`              | `{ "revision": 1, "lessonId": "everyday-b1" }`                      | Snapshot, HTTP 201                                 |
| POST   | `/sessions/:id/messages` | `{ "revision": 2, "requestId": "<uuid>", "text": "Hi, I am Mei." }` | Updated snapshot                                   |
| POST   | `/sessions/:id/finish`   | `{ "revision": 3 }`                                                 | Updated snapshot                                   |
| DELETE | `/data`                  | `{ "revision": 4 }`                                                 | `{ "deleted": true }`; clears guest cookie         |

`Snapshot` is defined in `src/domain/models.ts`: state, currently available lessons, capabilities, and the daily demo limit. Obtain revisions from the latest snapshot. A successful state mutation increments the revision once.

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

| Status | Meaning                                                                     |
| ------ | --------------------------------------------------------------------------- |
| 400    | Malformed/missing JSON                                                      |
| 401    | Guest cookie absent, invalid, or expired                                    |
| 403    | Disallowed request origin                                                   |
| 404    | Endpoint, owned session, or available lesson not found                      |
| 409    | Stale revision, incompatible session transition, or reused request ID       |
| 413    | Request body over 16 KiB                                                    |
| 415    | Non-JSON content type                                                       |
| 422    | Invalid fields or blocked control delimiters                                |
| 429    | Demo allowance, 40-turn session limit, or 100-session storage limit         |
| 503    | Provider timeout, invalid output, or unavailability; no turn committed      |
| 500    | Unexpected internal error; use the request ID to correlate safe server logs |

Speech endpoints are intentionally absent. A request to an unimplemented endpoint returns 404 instead of a simulated transcript or audio response.
