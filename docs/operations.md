# Local operations and hosting boundaries

## Configuration

Copy `.env.example` to `.env.local`. Secrets and database files are ignored by source control. Only the demo provider is supported. Configuration is parsed on first server use; errors report setting names without their values.

- `APP_ORIGIN`: exact browser origin, including port, no path or trailing slash.
- `COOKIE_SECURE`: `true` for HTTPS. Non-local HTTP origins are rejected.
- `DATABASE_PATH`: persistent local path, default `.data/teacher.db`.
- `DAILY_DEMO_UNIT_LIMIT`: per-guest, per-UTC-day allowance. Default 15,000 demo units.
- `PROVIDER_TIMEOUT_MS`: guard and teacher combined timeout. Default 10,000 ms.

Keep a single application instance with a local persistent disk for this adapter. The default scripts bind to `127.0.0.1`. A local production build is supported; it is not a public-release readiness signal.

## Data lifecycle

Guest identity expires 30 days after creation and is not sliding. The server rejects expired rows on every read/write. Expired rows are physically purged when the repository starts; a long-running deployment would need scheduled cleanup. The browser export downloads the current aggregate, recent message windows, receipts, profile, and progress. It contains personal text and should be treated as private.

Deleting through Preferences removes the active aggregate and expires its cookie. SQLite secure-delete is enabled, but filesystem snapshots, WAL remnants and backups need their own retention policy. Losing the browser cookie does not immediately delete the row; it becomes inaccessible and expires under the policy above. There is no recovery yet.

## Backup and restore

For a simple local backup, stop the server cleanly, then copy the entire `.data` directory, including any SQLite WAL/SHM sidecars. For live backups, use SQLite's online backup facility through a dedicated administrative script. Do not copy only the main `.db` file while writes are active.

Restore with the server stopped, preserve restrictive filesystem permissions, and start the same or a newer compatible application. Schema versions newer than the running app are rejected. Released SQL migrations are append-only; the migration runner applies new entries transactionally.

## Tests and observability

`npm run check`, `npm run build`, and `npm run test:e2e` are the basic checks. Browser tests isolate their data using `.data/e2e.db`; do not point them at real learner data. CI installs Chromium and runs the same flows.

`GET /api/v1/health` reports initialized demo service status without exposing filesystem paths or credentials. Every API response carries a request correlation ID. Unexpected failures log only an event, error class, and request ID. No prompt, transcript, cookie, provider response, or profile is logged. This is minimal operational logging, not an immutable audit trail.

## Before public or paid use

The current framework deliberately leaves the following release work open:

- Real account identity or a hardened guest-abuse policy, distributed rate limits, bootstrap limits, and abuse monitoring. Clearing cookies creates another allowance in this demo.
- PostgreSQL or an explicitly provisioned durable single-instance database, backup/restore exercises, scheduled expiry, and data migration procedures.
- TLS, environment-specific secret management, encryption at rest, privacy/consent/retention policy, and a decision about whether learner content can be sent to each provider.
- Real usage reservations/reconciliation and authenticated entitlements before any paid provider traffic.
- Live-model relevance, prompt-injection and educational evaluation; validated audio latency/naturalness, permission, cancellation and playback handling.
- Deployment-specific CSP, logging/monitoring and account-deletion behavior across backups and external providers. Current CSP only restricts framing, objects and base URLs; it is not a complete nonce-based policy.
- Automated accessibility checks plus manual keyboard/screen-reader review, broader browser/device checks, and load tests appropriate to the chosen deployment.

The security and copyright statements in the original concept plan are planning assumptions, not verified operational guarantees. This implementation adds no scraped textbooks, third-party character imitations, voice cloning, model fine-tuning data, or billing.
