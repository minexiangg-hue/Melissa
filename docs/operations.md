# Running and upgrading Melissa

## Configuration

Use Node.js 24 LTS. Copy `.env.example` to `.env.local` for local work. The deployed service instead loads the ignored, mode-600 `.env.preview`. Never commit credentials, guest databases or backup files.

| Setting                         | Purpose                                                                     |
| ------------------------------- | --------------------------------------------------------------------------- |
| `TEACHER_PROVIDER`              | `demo`, `codex`, or `openai-compatible`                                     |
| `APP_ORIGIN`                    | Exact browser origin, including port when needed; no path or trailing slash |
| `NEXT_PUBLIC_BASE_PATH`         | Empty locally; `/melissa` on this server; same at build/run time            |
| `MELISSA_BUILD_DIR`             | `.next` locally; `.next-preview` for the deployed build                     |
| `COOKIE_SECURE`                 | `true` behind HTTPS                                                         |
| `DATABASE_PATH`                 | Persistent SQLite path; keep `.data/teacher.db` when upgrading              |
| `PROVIDER_TIMEOUT_MS`           | Whole generation deadline; current preview uses 90,000 ms                   |
| `DAILY_AI_REQUEST_LIMIT`        | Per-guest UTC-day inference attempts, default 60                            |
| `GLOBAL_DAILY_AI_REQUEST_LIMIT` | Deployment UTC-day inference attempts, default 300                          |
| `AI_MAX_CONCURRENT_REQUESTS`    | Provider process/request concurrency, default 2                             |
| `DAILY_DEMO_UNIT_LIMIT`         | Scripted-demo meter only; does not estimate paid tokens                     |

Provider credentials and compatibility switches are documented in [AI providers](ai-providers.md). Health reports initialized service and configured mode, not a continuous upstream availability probe. Inspect the opt-in live checks after changing credentials or models.

## Server preview

Public URL: **https://hermoscare.com/melissa**.

```text
Browser /melissa → Nginx HTTPS :443 → Next.js 127.0.0.1:3200 → SQLite
                                                    ↘ Codex or external API
```

The main website's `/` route is separate. Nginx forwards the exact `/melissa` location and its descendants, preserving the path and Origin header. The optional 3201 listener redirects to the standard HTTPS URL; it is not required for browsing.

The preview uses these non-secret settings:

```dotenv
APP_ORIGIN=https://hermoscare.com
NEXT_PUBLIC_BASE_PATH=/melissa
MELISSA_BUILD_DIR=.next-preview
COOKIE_SECURE=true
DATABASE_PATH=.data/teacher.db
TEACHER_PROVIDER=codex
CODEX_MODEL=gpt-5.6-luna
PROVIDER_TIMEOUT_MS=90000
```

The systemd unit sets a PATH containing Node and Codex. The CLI requires a readable, configured Codex auth file. Its per-call copies and temporary workspace are private and removed after execution. Keep the source login fresh through the normal Codex authentication flow; the app does not rewrite it.

The unit makes source, dependencies and build output read-only except `.next-preview/cache` and `.data`. Private temporary storage is writable. The Nginx AI response timeout is 120 seconds, longer than the configured 90-second inference deadline. Keep the application deadline below the proxy and client deadlines.

## Release sequence

Run tests before changing the service:

```bash
npm run check
npm run test:e2e
npm run test:e2e:subpath
npm run format:check
node scripts/backup.mjs .env.preview
npm run build:preview
```

The browser suites both use port 3100, so run them sequentially. They use isolated `.data/e2e*.db` files and explicitly select demo providers. `.next-preview` separates production output from ordinary `.next` development/test output. For subsequent upgrades to a running `.next-preview` build, stop the service before replacing that directory, or build an additional named directory and switch the service/configuration together. Do not overwrite chunks being served.

For the reviewed server installation:

```bash
mkdir -p .data .next-preview/cache
sudo install -m 644 deploy/melissa.service /etc/systemd/system/melissa.service
sudo install -m 644 deploy/melissa-proxy.conf /etc/nginx/snippets/melissa-proxy.conf
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl restart melissa
sudo systemctl reload nginx
curl --fail --retry 8 --retry-all-errors --retry-delay 1 https://hermoscare.com/melissa/api/v1/health
```

First-time Nginx setup additionally installs `deploy/melissa.nginx.conf` into `sites-available`, enables it, installs `deploy/melissa.nginx.locations.conf` into `snippets`, and includes the locations file once inside the existing host's HTTPS server block. Preserve the existing main-site and HTTP/ACME configuration. The templates contain server-specific user, binary and certificate paths.

Inspect operational state with:

```bash
sudo systemctl status melissa --no-pager
sudo journalctl -u melissa -n 100 --no-pager
```

## Storage, expiry and rollback

Guest identity expires 30 days after creation. Old `yet_guest` cookies migrate without changing the owner or expiry. Existing v1 learner JSON gains an empty materials collection on read; SQL migration 2 adds the inference ledger. Released migrations are append-only and newer schemas are rejected by older releases.

Expired learners are rejected on every read/write and physically removed on startup and at most once per minute during subsequent identity/state reads. Deletion removes the learner aggregate and scrubs linked request fingerprints, provider request IDs and token metadata. Anonymous same-day request counts remain until the next UTC day so creating new cookies cannot reset the deployment allowance. These rows contain no learner text. Backups and filesystem snapshots have separate retention; remove obsolete backup copies according to the operator's policy.

`node scripts/backup.mjs .env.preview` uses Node/SQLite's consistent online backup API, writes into the database's `backups/` directory, and restricts file permissions. It never copies a live database file without its transaction state. Inspect the backup before a major migration. To restore an older application, stop the service and restore its matching pre-migration backup and environment/service/build configuration; do not point an older binary at schema 2. Restore only deliberately: it replaces newer learner activity.

## AI limits and recovery

The server reserves a request before any external generation. One guest's mutations are serialized with inference, and the completed request and learner aggregate commit in one transaction. A response lost after commit is recovered by the same request ID without calling the model again.

Timeouts and disconnections do not prove that an upstream provider charged nothing. Failed/uncertain attempts remain in the daily request allowance. `RETRY_REQUIRED` asks the UI to keep the draft and allocate a new ID on the next explicit submission; it never automatically retries a possibly paid action. Reported token totals and unknown-usage attempt counts are separate. Request caps limit exposure; they are not a currency-based billing system.

Codex and HTTP adapters cap concurrency, input/output bytes and elapsed time. Codex has no enabled execution host, shell, file, network-browsing, MCP, plugin or agent tools. Adversarial live tests verify the disabled-host diagnostic and that a harmless requested file write does not occur. New Codex runtime versions require repeating that test.

## Observability and remaining boundaries

API responses include a correlation ID. Unexpected errors log only event, error class and correlation ID. Prompts, transcripts, auth material and raw provider response bodies are not logged. The application does not yet implement account recovery, entitlement billing, multi-host storage, microphone input/STT, or formal proficiency assessment.

Bootstrap is rate-limited by Nginx; inference is additionally bounded by durable guest/global quotas. A larger public launch needs account abuse controls, measured load limits, monitoring and external-provider data-retention decisions. Current TLS, origin checks, opaque cookies and CSP protections are a foundation rather than a compliance certification.

## Local Kokoro voice

The optional CPU speech service has its own systemd unit and private environment. Follow [speech worker deployment](speech-worker.md) and [audio configuration](audio.md). Start and verify the worker before enabling `SPEECH_PROVIDER=kokoro` in Melissa. It is loopback-only and does not require another public port. Keep model preparation separate from serving requests.

SQL migration 3 adds a separate speech-attempt table. Make an online SQLite backup before the first upgraded startup; old binaries reject newer schemas. For rollback, stop the app and restore the matching database backup together with its original build/settings. Do not copy a WAL database file on its own or restore over a running database.
