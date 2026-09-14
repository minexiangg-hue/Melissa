# Connecting the open integrations

The framework can be exercised without credentials. Add integrations only through the boundaries below. Capability flags must reflect adapters that actually work, not the presence of a key.

## Real teacher and guard

1. Implement `GuardProvider` and `TeacherProvider` from `src/domain/ports.ts` in new server-only provider files. Keep vendor SDKs and credentials out of `domain/` and browser bundles.
2. Map trusted `context.system` to the vendor's actual system/developer message role. Put structured learner, lesson, and memory data in a separate explicitly untrusted context message. Append recent messages with their original roles and `context.input` as the new user message. Do not concatenate learner text into system instructions.
3. Validate guard intent and teacher output at the existing orchestrator boundary. Do not let a teacher write state, select arbitrary owners, or call the database.
4. Honor `AbortSignal`, cap input and output tokens, and classify retryable vendor failures without leaking their raw response bodies to clients or logs.
5. Before paid inference, implement a durable request ledger: reserve usage, serialize active turns for a learner, store provider request IDs, reconcile measured usage even on uncertain network outcomes, and release or expire reservations safely. Extend the repository transaction API as necessary. The demo CAS alone cannot prevent duplicate external charges.
6. Add provider selection to `server/config.ts` and `container.ts`, then update the typed capability schema and UI labels. Unknown/missing required settings must fail closed; never present a demo as live AI.
7. Add fake-server adapter contract tests, adversarial prompt cases, relevance evaluations, and rollback/timeout/rate-limit tests. Keep `npm test` credential-free. Opt-in live smoke tests must not run in ordinary CI.

There is no assumed API vendor or model ID in this foundation. Choose these with measured latency, cost, data handling and teaching quality once service access is available.

## Audio

The domain already defines separate transcription and synthesis ports. Future HTTP routes should authenticate before processing, validate MIME types and decoded duration, bound upload bytes, reserve usage, enforce a timeout, and avoid storing audio unless a retention policy specifically requires it.

The browser needs a MediaRecorder state machine with explicit permission, recording, stopping, transcribing, thinking, playback and error states. Stop media tracks on cancellation/unmount, revoke object URLs, handle unsupported formats, autoplay denial, microphone denial, and keep the editable transcript as a fallback. Update the current `Permissions-Policy` only when microphone capture is implemented.

Measure `speech-end → transcription`, `transcription → first teacher text`, `teacher text → first audio byte`, and **speech-end → audible playback** independently. Current `lastTurnMs` is demo guard/teacher processing time, not voice latency. The plan's latency and naturalness acceptance criteria remain unvalidated.

Start with bounded HTTP STT/teacher/TTS calls. Introduce SSE or WebSocket streaming only after measuring that path; keep transport independent from state transitions.

## Database

Implement `LearnerRepository` with PostgreSQL/Prisma. Detached reads, owner scoping, expiry, schema-version handling, atomic revision checks, and single-commit updates are mandatory. Run the existing repository contract scenarios against the new adapter. Prefer an initial JSONB aggregate with a revision column to a premature large normalized schema.

Export existing aggregates using the application while guest identity is still available. For an administrative migration, use a transactionally consistent database export containing owner hashes and expiry fields; the user-facing export deliberately lacks authentication material. Import with schema validation and reconcile guest identity separately. Never copy a live WAL-backed database file alone.

## Accounts, billing and other future features

- **Accounts:** replace the small HTTP identity resolver, attach migrated guest aggregates to verified accounts, and add sign-out/recovery/session rotation. Authorization must remain outside the teaching prompt.
- **Billing:** add an entitlement service and a signed, replay-safe webhook ledger. Plan labels, pricing, and payment UI remain absent until a payment provider and product policy exist.
- **Curriculum and materials:** build on the versioned original scenario seeds and `teachingGuidelines`. Store provenance and prompt versions. A formal CEFR assessment must use validated tasks and cannot reuse participation counters as scores.
- **Memory:** extend the structured summary with validated error/knowledge evidence; keep raw learner text out of trusted instructions. Historical teacher messages are intentionally not fully retained in this version.
- **Brand/persona:** the product name is Melissa and persona guidance lives with teaching rules. Introduce approved artwork and personality definitions without changing orchestration or database code.
- **PWA:** add a manifest, approved icons and a narrowly scoped service worker. Do not cache private API snapshots or transcripts as public offline assets.

These are documented integration seams, not claims that the underlying services are implemented.
