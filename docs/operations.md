# Operations and hosting boundaries

## Configuration

Copy `.env.example` to `.env.local`. Secrets and database files are ignored by source control. Only the demo provider is supported. Configuration is parsed on first server use; errors report setting names without their values.

- `APP_ORIGIN`: exact browser origin, including a nonstandard port when used, no path or trailing slash.
- `NEXT_PUBLIC_BASE_PATH`: empty for the default root-path app, or a path such as `/melissa`. Set the same value at build time and runtime; changing it requires a rebuild.
- `COOKIE_SECURE`: `true` for HTTPS. Non-local HTTP origins are rejected.
- `DATABASE_PATH`: persistent local path, default `.data/teacher.db`.
- `DAILY_DEMO_UNIT_LIMIT`: per-guest, per-UTC-day allowance. Default 15,000 demo units.
- `PROVIDER_TIMEOUT_MS`: guard and teacher combined timeout. Default 10,000 ms.

Keep a single application instance with a local persistent disk for this adapter. The default scripts bind to `127.0.0.1`. A local production build is supported; it is not a public-release readiness signal.

## Server preview

The preview is running at **https://hermoscare.com/melissa**, using the existing public HTTPS port 443. A public-network fetch and an HTTPS browser flow covering setup, practice, refresh recovery, and deletion have passed. The main site at `/` continues to respond normally:

```text
Browser /melissa → Nginx HTTPS :443 → Next.js 127.0.0.1:3200 → local SQLite
```

Nginx uses the server's certificate for `hermoscare.com`. Only the exact `/melissa` path and its `/melissa/` descendants are forwarded to this application. The existing main site's routes keep their current handlers. The production application is managed by `melissa.service` and binds to loopback.

The service reads `.env.preview` from the project directory. This file is ignored by Git and separate from `.env.local`, so local development and browser tests keep their own origin, path, and database settings:

```dotenv
APP_ORIGIN=https://hermoscare.com
NEXT_PUBLIC_BASE_PATH=/melissa
COOKIE_SECURE=true
DATABASE_PATH=.data/teacher.db
```

`APP_ORIGIN` contains only the scheme and hostname; do not append `/melissa`. `NEXT_PUBLIC_BASE_PATH` is included in the browser build and must also match the running server. Use `npm run build:preview`, which runs `scripts/build-preview.mjs` to load `.env.preview` before building. A plain `npm run build` uses the normal development/root-path configuration unless another base path is supplied. After changing the base path, rebuild before restarting the service.

Keep the existing database path when upgrading. This preview reuses the server's learner data and applies ordered schema migrations; it does not create a separate empty database just because the product name changed. [Branding and upgrade compatibility](branding.md) describes the guest-cookie migration.

Inspect and manage the service with:

```bash
sudo systemctl status melissa --no-pager
sudo systemctl restart melissa
sudo journalctl -u melissa -n 100 --no-pager
```

The proxy forwards the browser's Origin unchanged. It limits bootstrap requests per client IP (10/minute, with a burst of 20) and returns JSON errors for proxy-level request-size and rate-limit failures. This is a preview limit, not a replacement for distributed account abuse controls.

When updating the preview, stop the service before replacing build output, run the checks and browser suites sequentially, then build the preview:

```bash
sudo systemctl stop melissa
npm run check
npm run test:e2e
npm run test:e2e:subpath
npm run build:preview
mkdir -p .data .next/cache
sudo systemctl start melissa
```

The reviewed service file makes only `.data` and `.next/cache` writable at runtime. Prepare the private `.env.preview` and build before starting it. Deployment templates are specific to this server's user, Node installation, and certificate paths; review them before installing elsewhere.

The deployment files have distinct scopes:

| Repository template                                                             | Installed location                                                     | Purpose                                                                      |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [`deploy/melissa.service`](../deploy/melissa.service)                           | `/etc/systemd/system/melissa.service`                                  | Run the production application.                                              |
| [`deploy/melissa.nginx.conf`](../deploy/melissa.nginx.conf)                     | `/etc/nginx/sites-available/melissa.conf`, linked from `sites-enabled` | Define the shared bootstrap rate-limit zone and optional port 3201 redirect. |
| [`deploy/melissa.nginx.locations.conf`](../deploy/melissa.nginx.locations.conf) | `/etc/nginx/snippets/melissa.nginx.locations.conf`                     | Match `/melissa` and `/melissa/` inside the existing HTTPS server.           |
| [`deploy/melissa-proxy.conf`](../deploy/melissa-proxy.conf)                     | `/etc/nginx/snippets/melissa-proxy.conf`                               | Forward the original path and headers to the loopback application.           |

For initial installation, prepare `.env.preview` and build first. If the application is already running, stop it before these checks and build steps, as in the update sequence above. Preserve the existing main-site configuration before editing it:

```bash
npm run check
npm run build:preview
mkdir -p .data .next/cache
sudo cp -a --no-clobber /etc/nginx/sites-available/hermoscare.conf /etc/nginx/sites-available/hermoscare.conf.before-melissa
```

Install the templates:

```bash
sudo install -m 644 deploy/melissa.service /etc/systemd/system/melissa.service
sudo install -m 644 deploy/melissa.nginx.conf /etc/nginx/sites-available/melissa.conf
sudo install -m 644 deploy/melissa.nginx.locations.conf /etc/nginx/snippets/melissa.nginx.locations.conf
sudo install -m 644 deploy/melissa-proxy.conf /etc/nginx/snippets/melissa-proxy.conf
sudo ln -sfn /etc/nginx/sites-available/melissa.conf /etc/nginx/sites-enabled/melissa.conf
```

In `/etc/nginx/sites-available/hermoscare.conf`, add the following include **once inside the HTTPS server block listening on 443**, before its existing `location /` block. Keep the HTTP/ACME server and the main site's locations in place. The locations snippet belongs at server scope; the shared limiter file above must also be loaded at HTTP scope.

```nginx
include /etc/nginx/snippets/melissa.nginx.locations.conf;
```

Validate before reloading:

```bash
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable --now melissa
sudo systemctl reload nginx
```

A health check through the public preview route is:

```bash
curl --fail https://hermoscare.com/melissa/api/v1/health
```

Use this standard HTTPS URL to browse; no additional cloud firewall port is required. Port 3201 passed local TLS checks but timed out from the public network. Its optional listener redirects to the canonical HTTPS path if it becomes reachable; it is not the application's browsing endpoint. The canonical `/melissa` route has already been checked from a separate network and through a real HTTPS browser session.

## Data lifecycle

Guest identity expires 30 days after creation and is not sliding. The server rejects expired rows on every read/write. Expired rows are physically purged when the repository starts; a long-running deployment would need scheduled cleanup. The browser export downloads the current aggregate, recent message windows, receipts, profile, and progress. It contains personal text and should be treated as private.

Deleting through Preferences removes the active aggregate and expires its cookie. SQLite secure-delete is enabled, but filesystem snapshots, WAL remnants and backups need their own retention policy. Losing the browser cookie does not immediately delete the row; it becomes inaccessible and expires under the policy above. There is no recovery yet.

## Backup and restore

For a simple local backup, stop the server cleanly, then copy the entire `.data` directory, including any SQLite WAL/SHM sidecars. For live backups, use SQLite's online backup facility through a dedicated administrative script. Do not copy only the main `.db` file while writes are active.

Restore with the server stopped, preserve restrictive filesystem permissions, and start the same or a newer compatible application. Schema versions newer than the running app are rejected. Released SQL migrations are append-only; the migration runner applies new entries transactionally.

## Tests and observability

`npm run check`, `npm run build`, `npm run test:e2e`, and `npm run test:e2e:subpath` are the basic checks. Run the browser suites sequentially because both use port 3100. The root-path suite isolates its data in `.data/e2e.db`; the subpath suite uses `.data/e2e-subpath.db`. Do not point either suite at real learner data. Use `npm run build:preview` for the actual server deployment.

`GET /api/v1/health` reports initialized demo service status without exposing filesystem paths or credentials; prepend the configured base path when browsing through a subpath deployment. Application API responses carry a request correlation ID; errors generated directly by the proxy use their own documented JSON body. Unexpected failures log only an event, error class, and request ID. No prompt, transcript, cookie, provider response, or profile is logged. This is minimal operational logging, not an immutable audit trail.

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
