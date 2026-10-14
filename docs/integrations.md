# Implemented adapters and extension points

The application has explicit `demo`, `codex`, and `openai-compatible` modes. Demo works offline; the two live modes generate actual tutoring and learning materials. Capability labels describe the selected implementation, while runtime errors remain visible rather than silently falling back to authored responses.

## Teacher and material generation

`StructuredGenerator` in `src/server/providers/structured.ts` is shared by `AiTeacher` and `AiMaterialProvider`. A request contains trusted system instructions, a separate input string, a Zod schema, a name, and an output-token preference. The transport returns validated data, reported usage or `null`, and an optional provider request ID.

`OpenAICompatibleGenerator` implements Chat Completions with strict JSON Schema or explicit JSON mode, configurable model/API prefix, bounded responses, deadlines, and redirect rejection. Credentials remain server-side. `CodexGenerator` invokes an authenticated local CLI in a private temporary home and empty workspace with tools disabled, bounded subprocess output, cancellation, and cleanup. It does not expose a general coding-agent endpoint. See [AI setup and limits](ai-providers.md) and `.env.example`.

The installed Codex adapter has passed live correction and execution-isolation checks. The external API adapter has been tested against a real loopback HTTP contract fixture; no external API key was available for a billable live smoke test. Configure the key and model before running the opt-in external check. Ordinary CI never requires credentials or spends model quota.

When adding another transport:

1. Implement `StructuredGenerator` in a server-only module, preserving explicit system/input separation and runtime output validation. Never give generation access to repositories or browser-selected identities.
2. Honor abort/deadline signals, cap request/output size, report actual usage when supplied, and represent missing usage explicitly. Do not expose provider response bodies or secrets in public errors.
3. Wire it through `container.ts` and the existing metered generator. Live calls require a durable inference reservation before the transport starts.
4. Add credential-free contract tests for output validation, refusal/truncation, redacted failures, cancellation, concurrency, and usage. Keep live checks opt-in.
5. Extend validated configuration and capability types. A transport that fails authentication or generation must report failure, not claim a demo result came from AI.

The current `DemoGuard` remains a cheap deterministic intent classifier in all modes. A semantic guard can replace `GuardProvider`, but any additional model call must participate in the same reservation/metering design. Evaluate correction quality, relevant follow-up questions, bilingual help, and content-level prompt attacks separately from structural correctness.

## Quotas and transactions

The durable request ledger is implemented. It reserves guest/global UTC allowances, leases the owner, records reported token usage plus unknown-usage state, and atomically finalizes the validated learner mutation with request completion. Synchronous non-inference mutations use the same lease guard inside a transaction.

Keep all database work within these short transaction boundaries. Do not await a model or network service inside a transaction. Keep identity, reservation IDs, provider request IDs, and database handles out of model prompts.

There is no automatic retry after an uncertain upstream outcome. A saved success is recovered through the learner's receipts/material IDs. Failed or crashed attempts consume their request allowance and require an explicit new send. This prevents automatic duplicate calls; it does not assert that a timeout was free or that request allowances equal a provider invoice. Use the provider's own spending controls as well.

## Curriculum and knowledge

Custom material generation and persistence are implemented. The library includes twelve original seeds, six level guides, reviewed factual source notes, provenance, a reader, answer explanations, and conversion into guided conversation. The demo material provider returns an authored seed; live providers adapt it to the requested topic and level.

Extend `content/learning/` following [its authoring guide](../content/learning/README.md). Record source rights and provenance, add original examples, validate answer indexes and distinct choices, and review exercises for actual answer correctness. Bump the knowledge version when teaching content changes. The CEFR link is reference-only; the collection is not an official assessment or a complete syllabus.

The present retriever uses goal, topic terms, and level distance. If the collection outgrows that approach, introduce a retrieval interface with bounded results before adding embeddings or a vector store. Preserve the rule that retrieved content is subject matter, not executable instructions. Source attribution must remain available to the reader.

## Audio

An optional Listen control already uses device/browser speech synthesis. It is user-initiated, cancellable, and hidden when unsupported; it is not a dedicated server voice. Server transcription and synthesis ports remain separate extension seams.

For microphone input, add authenticated routes with MIME/duration/byte limits, usage reservation, deadlines, and a clear audio retention policy. Implement explicit permission, recording, stopping, transcribing, thinking, playback, and error states. Stop media tracks on cancellation/unmount and keep an editable transcript fallback. Change microphone permissions only with the recording implementation.

Measure transcription, teacher text, synthesis, and speech-end-to-audible-playback separately. Current text turn latency and browser read-aloud do not validate the original voice-latency or naturalness targets. Introduce streaming only after measuring a bounded HTTP path; keep transport separate from lesson state transitions.

## Database and accounts

A PostgreSQL migration must preserve detached owner-scoped reads, expiry, data versions, expected revisions, successful replay behavior, durable request allowances, and atomic lease/aggregate completion. Start with a JSONB aggregate and revision column if useful. Extract the SQLite-specific inference unit-of-work boundary as part of that migration rather than moving only the learner repository.

Use a consistent backup containing owner hashes, revisions, and expiry for an administrative migration. User-facing exports deliberately omit authentication material. Never copy a live WAL database file alone; verify restoration before switching storage.

Accounts require a verified identity provider, guest-to-account migration, session rotation, sign-out/recovery, and ownership checks outside prompts. None is implemented yet. Billing separately requires entitlements and signed, replay-safe payment webhooks; inference usage tracking is not a payment system.

## Other extensions

- **Assessment and memory:** add validated task evidence and human-reviewed evaluation before deriving proficiency or review schedules. Current objective counters measure participation. Keep raw learner text out of trusted memory instructions.
- **Character and voice:** Melissa's illustrated character, avatar, and brand assets are implemented. Extend that identity through presentation assets and persona guidance; do not couple artwork changes to orchestration or persistence.
- **PWA and offline use:** add an appropriate manifest and scoped service worker if needed. Never cache private API snapshots or transcripts as public assets.
- **Observability:** add structured operational metrics without prompts or secrets. Distinguish attempted requests, reported token usage, unknown usage, and provider billing.
