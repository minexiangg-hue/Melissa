# Melissa

An English-learning studio with a real AI companion, a personal lesson library, and a small, memorable honey-colored guide.

**Live preview: [hermoscare.com/melissa](https://hermoscare.com/melissa).** The deployed edition uses Codex for original replies and lesson generation. The repository also implements an external OpenAI-compatible API adapter and an explicit offline demo mode.

The project directory remains `YourEnglishTeacher`. Existing guest identity, learner records and practice history survive the upgrade.

## Run locally

Use Node.js 24 LTS:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open **http://127.0.0.1:3000**. The default is `TEACHER_PROVIDER=demo`, so a clean checkout runs without credentials. This mode is labeled in the interface and uses authored content.

For real Codex generation, authenticate the local Codex CLI, then set these in your private `.env.local`:

```dotenv
TEACHER_PROVIDER=codex
CODEX_MODEL=gpt-5.6-luna
PROVIDER_TIMEOUT_MS=90000
```

For an external API, set `TEACHER_PROVIDER=openai-compatible`, `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY`. Keys remain server-side. Strict JSON Schema and JSON-object modes are supported; see [AI provider configuration and verification](docs/ai-providers.md). The current server has authenticated Codex access; a live external-API check requires its own credential.

## The learning loop

1. Choose a name, self-reported level, goal and daily pace.
2. Start a guided conversation, or create a lesson around something you want to say.
3. Read the lesson, explore vocabulary, and answer questions with explanations.
4. Practice the lesson with Melissa, who can refer to its reading, dialogue and exercises.
5. Reopen saved lessons and conversations in your library and notebook.

The app includes 12 original lesson seeds, level-specific writing guidance, and reviewed source notes with provenance. Real AI writes new materials tailored to the requested topic and level; the demo selects authored samples. Source material and maintenance instructions live in [content/learning](content/learning/README.md).

Optional **Listen** buttons can use a self-hosted Kokoro voice, with explicit device read-aloud as a fallback. See [audio setup and boundaries](docs/audio.md). Microphone input and transcription remain open integrations. Progress describes participation, not a validated CEFR score or pronunciation assessment.

## Foundation

- Separate domain, orchestration, provider, HTTP and SQLite storage modules.
- Durable AI reservations, per-learner serialization and daily guest/global request limits before inference.
- Atomic learning-state and completion commits, safe replay of saved results, and explicit retries for uncertain upstream failures.
- Reported token usage recorded separately from unknown usage; request limits include failed attempts and are not billing estimates.
- Schema-validated materials, detached lesson snapshots, bounded context, timeouts, output-size limits and concurrency caps.
- Codex runs in a private temporary workspace with tools and user configuration disabled. Learner text is never executed.
- Opaque guest cookies, exact-origin mutation checks, owner-scoped persistence, data export/deletion and expiry cleanup.
- Responsive light/dark interface, keyboard navigation, reduced motion and self-hosted fonts.

Guest identity lasts 30 days and has no account recovery or cross-device sync. SQLite is intended for this single-server preview, not a serverless or multi-host deployment. AI output can still contain mistakes; provenance and structural validation do not prove educational correctness.

## Verification

```bash
npm run check
npm run build
npm run test:e2e
npm run test:e2e:subpath
npm run format:check
```

Run browser suites sequentially; both use port 3100 and isolated test databases. Ordinary tests do not make paid calls. For an opt-in real provider check:

```bash
MELISSA_LIVE_CODEX=1 npx vitest run tests/providers.live.test.ts tests/learning.live.test.ts
# With externally supplied API configuration:
MELISSA_LIVE_API=1 npx vitest run tests/providers.live.test.ts tests/learning.live.test.ts
```

## Project map

```text
content/learning/      Original scenes, authoring rules and source provenance
public/brand/         Melissa character and avatar
public/fonts/         Self-hosted typefaces and licenses
src/app/              Next.js entry points and modular visual styles
src/components/       Studio, library, materials, practice, notebook and preferences
src/domain/           Learning contracts, validation, curriculum and context
src/server/
  inference/          Durable request coordination and usage ledger
  learning/           Knowledge retrieval and material generation
  providers/          Demo, external API and isolated Codex adapters
  speech/             Kokoro transport, owned-text authorization and audio limits
  storage/            SQLite and ordered migrations
  http/               Authenticated versioned API boundary
  orchestrator.ts     Learning transitions and atomic state ownership
services/speech/      Isolated CPU Kokoro worker and pinned model preparation
tests/                Unit, HTTP, provider, live-opt-in and browser checks
deploy/               Server-specific HTTPS proxy and systemd templates
docs/                 Architecture, operations, integrations and identity
```

See [architecture](docs/architecture.md), [API](docs/api.md), [deployment](docs/operations.md), [lesson design](docs/learning.md), and [Melissa's identity](docs/brand/identity.md). The original [development plan](plan.html) remains the long-term brief; [the roadmap](docs/roadmap.md) records what this edition implements.
