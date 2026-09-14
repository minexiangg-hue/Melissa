# Foundation handoff and next steps

## Delivered in this stage

The project is now runnable with no service accounts. The working slice covers onboarding → scenario selection → bounded guided text conversation → durable progress, including recovery after page refresh. Core state, API, persistence and provider contracts are implemented, with tests and a responsive UI.

The three named agent layers exist as boundaries. Guard and Teacher are deterministic demo adapters; the orchestrator and prompt builder are real application logic. Learned proficiency, natural voice quality, usage prices, and formal assessment are not fabricated.

## Suggested sequence

1. **Validate the voice hypothesis from the original plan.** Connect one real teacher plus STT/TTS behind the existing ports, add explicit usage reservations, and record audio latency and naturalness. Keep this experiment narrow. The plan's stated latency targets are hypotheses until measured.
2. **Evaluate teaching behavior.** Replace the demo intent heuristic, add level-specific original tasks, test corrections and redirection, and have humans review a small evaluation set. Only then introduce assessment-derived level changes.
3. **Prepare identity and hosting.** Select an account provider and deployment region; implement a PostgreSQL adapter, guest-to-account migration, durable rate limiting, data retention, and operational monitoring.
4. **Expand personalization.** Generate versioned lesson materials, store evidence of recurring errors, and build review scheduling. Keep these services separate from the read-only teacher response interface.
5. **Add product breadth after evidence.** Streaming voice, approved persona artwork, PWA, billing, reminders and scenario stories can build on the same boundaries.

## Acceptance checks for future changes

- A failed provider call never partially advances lesson state.
- Replayed requests cannot duplicate messages or usage; paid integrations also prevent duplicate provider spending.
- No learner can access another learner's aggregate.
- Context is bounded independently of the age/length of practice history.
- New provider outputs are runtime-validated and cannot select trusted owner/state fields.
- Provider secrets and SDKs remain server-only.
- A new database adapter satisfies the repository contract tests.
- UI errors preserve recoverable input, and inactive capabilities remain honestly labeled.

## Deliberate choices versus the plan

SQLite replaces PostgreSQL/Prisma **for the local foundation only**. Native CSS tokens replace an extra styling framework for a small, coherent UI. There is one responsive app route with internal practice/progress/preferences views; it can be mounted at `/` or under a configured base path such as `/melissa`. The versioned HTTP API is independent of that presentation. Authentication, payment, vectors, elaborate multi-agent frameworks and streaming transports are deferred to avoid introducing infrastructure with no validated use yet.

The Melissa name and a server preview at `https://hermoscare.com/melissa` are included. A permanent brand character, a complete CEFR syllabus, a humanlike audio experience, and the operational work needed for general public release remain open.
