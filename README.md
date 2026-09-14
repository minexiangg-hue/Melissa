# Melissa

A working, local-first foundation for the speaking-first English teacher described in [the development plan](plan.html). This implementation focuses on durable application boundaries and a small, usable learning loop.

The product is named **Melissa**. The existing local project directory remains `YourEnglishTeacher`; see [branding and upgrade compatibility](docs/branding.md).

**Current stage: a text-practice foundation with a clearly labeled, deterministic demo teacher.** No paid API, API key, database server, or external account is required. This is not the completed Phase 1 MVP or a validated voice prototype.

## Run it

Use **Node.js 24 LTS** (`nvm use` if you have nvm), then:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open **http://127.0.0.1:3000**. Use that exact hostname: mutation requests must match `APP_ORIGIN`. To use `localhost` or another port, update `APP_ORIGIN` and the development command together.

SQLite is created automatically at `.data/teacher.db`. Profiles and practice survive restarts. The application binds to loopback by default. The database adapter uses Node's built-in `node:sqlite`, which is experimental in Node 24; its use is isolated behind the repository interface.

```bash
npm run build
npm start
```

The production build runs locally with the same configuration.

## Server preview

The server preview is running at **https://hermoscare.com/melissa**. Public-network access and an HTTPS browser practice flow have been verified. Nginx serves Melissa under `/melissa` through the server's existing HTTPS port 443 and forwards that path to the production app on `127.0.0.1:3200`. The app runs as the `melissa` systemd service, using a separate, ignored `.env.preview` file. The local directory and learner database remain in place.

For this deployment, `.env.preview` sets `APP_ORIGIN=https://hermoscare.com`, `NEXT_PUBLIC_BASE_PATH=/melissa`, and `COOKIE_SECURE=true`. Build with `npm run build:preview` so the client assets and server use the same base path. The default development configuration serves the app at `/` with an empty base path.

See [server preview operations](docs/operations.md#server-preview) for configuration, service commands, and connectivity checks. No additional cloud firewall port needs to be opened for this URL. Port 3201 is an optional redirect to the address above if it becomes reachable; use the standard HTTPS URL to browse. This preview still uses the scripted demo teacher; the [public release work](docs/operations.md#before-public-or-paid-use) remains open.

## What works

- Responsive onboarding, three practice scenarios, a conversation room, preferences, and a progress notebook.
- A self-reported A1–C2 level, learning goal, first language, and daily time preference. Level changes apply to new lessons.
- Input rules → Guard → Orchestrator → Prompt Builder → Teacher, with only the orchestrator allowed to mutate learning state.
- Original scenario seeds for everyday, travel, and workplace practice, with level-specific prompt guidance. This is not a full CEFR curriculum.
- Persisted lesson snapshots, participation tracking, active-time estimates, a bounded 12-message context, and structured memory.
- Opaque guest cookies, owner-scoped storage, revision-based conflict detection, retry-safe turns, provider timeouts, bounded payloads, and a daily demo allowance.
- Data export and deletion, explicit loading/error/empty states, keyboard support, and responsive layouts.

## Intentionally open integrations

| Area                                 | Current behavior                                | Extension point                                                                    |
| ------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| AI teacher / semantic guard          | Scripted local providers                        | `GuardProvider`, `TeacherProvider`, server composition root                        |
| Speech recognition / synthesis       | Not connected; microphone disabled              | `SpeechToTextProvider`, `TextToSpeechProvider`                                     |
| PostgreSQL / Prisma                  | Durable single-process SQLite implementation    | `LearnerRepository` contract and migration notes                                   |
| Accounts / recovery                  | Guest session only, 30-day expiry               | Replace identity resolution and associate guest data with an authenticated account |
| Billing / real token usage           | No billing; estimated demo units only           | Reserve and reconcile usage around provider calls                                  |
| CEFR assessment / adaptive materials | Self-reported level and authored scenario seeds | Versioned curriculum, assessment service, evaluation corpus                        |
| Character artwork / visual identity  | Melissa name and neutral teacher identity       | Design tokens, persona guidelines, replaceable artwork                             |
| PWA / streaming voice                | Responsive web only                             | Manifest/service worker and a separately measured audio transport                  |

Unknown providers fail configuration validation instead of silently falling back. No empty API endpoints pretend to implement a service. See [integration instructions](docs/integrations.md).

## Checks

```bash
npm run check           # ESLint, strict TypeScript, backend tests
npm run build           # Production build
npx playwright install chromium
npm run test:e2e        # Desktop and mobile tests at /
npm run test:e2e:subpath # The same browser flows at /melissa
npm run format:check
```

Run the two browser suites sequentially: both use port 3100 and start/stop their own development server. The root-path suite uses `.data/e2e.db`; the subpath suite uses `.data/e2e-subpath.db`. Unit and HTTP tests use isolated in-memory databases; the persistence test also reopens a temporary disk database.

## Project map

```text
src/
  app/                 Next.js pages, application theme, versioned API entry point
  components/          Practice UI and browser API client
  domain/              Types, validation, curriculum, prompts, provider/repository ports
  server/
    orchestrator.ts    Learning-state transitions and turn lifecycle
    container.ts       Adapter selection and dependency wiring
    config.ts          Validated server configuration
    http/              Identity, request limits, origin checks, API error mapping
    providers/         Deterministic demo Guard and Teacher
    storage/           SQLite adapter and ordered schema migrations
tests/                 Domain, storage, HTTP, configuration and browser checks
docs/                  Architecture, API, operations, integration work and roadmap
```

Read [architecture](docs/architecture.md) before adding stateful features, [API contracts](docs/api.md) before adding another client, and [the next development steps](docs/roadmap.md) before expanding scope. The concept brief (`instructions.txt`) and development plan (`plan.html`) retain the original scope and now use the Melissa name; the implementation status is documented here and in the roadmap.
