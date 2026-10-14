# Current release and next steps

## Delivered

Melissa now offers a real learning workflow: onboarding → lesson selection or custom lesson creation → reading, vocabulary and exercises → guided AI conversation → saved progress. Profiles, materials, and sessions survive refreshes. Existing guest identity and history remain compatible with the renamed project and new material collection.

Both requested inference paths are implemented. Local Codex supplies real generation using the installed authenticated CLI; external OpenAI-compatible APIs use server-side configuration. Demo remains an explicit offline mode. Durable request reservations, owner leases, guest/global allowances, bounded inference, reported/unknown usage, and atomic state completion support live calls. Uncertain calls are not automatically retried.

The UI has been rebuilt around a responsive learning studio with a designed Melissa character and avatar, local typography, lesson library, material reader, conversation, progress, and preferences. Browser read-aloud is available where the device supports it. Visual quality remains subject to review; these changes are not a claim of winning or meeting an independently certified design award.

The knowledge foundation contains twelve original scenarios, A1–C2 authoring guidance, and reviewed source notes with attribution. Live generation adapts that material to a requested topic and level. Stored materials include readings, dialogue, vocabulary, exercises, explanations, and conversation objectives. Structural validation does not certify factual accuracy or pedagogical effectiveness.

Codex has passed live correction and execution-isolation checks. The external API transport has credential-free HTTP contract coverage; a billable live check still requires the operator's API key and model. Accounts, microphone input/transcription, a dedicated synthesized voice, formal assessment, subscriptions, payments, and cross-device sync remain open.

## Next development sequence

1. **Evaluate the teaching experience.** Build a reviewed set of learner examples across levels, including corrections, unclear requests, bilingual help, topic changes, and prompt attacks. Review generated exercises for answer correctness and level fit. Replace the heuristic guard only with measured evidence that a semantic alternative improves behavior.
2. **Strengthen the authoring collection.** Expand the original seeds and reviewed source notes; add per-material authoring/version metadata where useful for reproducibility. Improve retrieval when the collection warrants it, and add review scheduling using demonstrated learning evidence. Preserve provenance and avoid treating reference material as an official CEFR syllabus.
3. **Validate the voice hypothesis.** Connect authenticated STT and a dedicated TTS adapter, implement microphone state and privacy controls, and measure the complete speech-to-speech path. Device read-aloud does not establish natural voice quality or latency. Consider streaming after a reliable bounded path works.
4. **Prepare broader hosting and identity.** Introduce accounts, guest migration, recovery, asynchronous persistence, monitoring, backups, and an operational data-retention process. Migrate the inference ledger and aggregate transaction together. Review usage limits and service capacity before expanding public access.
5. **Add product breadth after evidence.** Recurring review, offline/PWA support, reminders, richer scenario stories, and paid entitlements can build on the current boundaries. Payment UI and proficiency claims should arrive with their actual underlying systems.

## Acceptance checks for future changes

- Both live transports generate through the shared validated contract; provider selection never disguises an offline result as AI.
- Failed inference does not partially advance a lesson, append a message, or create a material.
- Successful replay does not duplicate saved work or invoke the model again. Uncertain attempts remain distinguishable and are never automatically retried.
- An owner lease is reserved before live generation and retained until learner state and request completion commit atomically. Other mutations check that lease within their own transaction.
- Daily request allowances survive process restarts and cannot be reset globally by deleting a guest. Reported token counts and unknown usage remain separate from currency and billing.
- No learner can select or read another learner's aggregate. Deletion/expiry remove personal inference metadata, and a late provider result cannot restore it.
- Context, model output, subprocess lifetime, stored history, sessions, and materials stay bounded.
- Generated exercises have valid structure and checked answer relationships; human or evaluation evidence supports claims about their teaching quality.
- Browser errors preserve recoverable drafts, keyboard and mobile flows remain usable, and optional audio behaves honestly when unavailable.
- Root-path and `/melissa` builds both work; changes pass the relevant unit, integration, browser, accessibility, and build checks. Live model checks remain explicit opt-in operations.

## Deliberate choices

The application keeps SQLite and native CSS for this server-hosted preview. It uses a responsive app with internal studio/library/practice/progress/preferences views, while the versioned HTTP API remains independent of the presentation. It can mount at `/` or under the configured `/melissa` prefix.

The knowledge collection uses reviewed local data and deterministic retrieval rather than a vector service. Real generation is shared between tutoring and material creation rather than hidden behind an elaborate agent framework. Codex is isolated as an inference adapter; external API credentials and account quotas remain operator concerns. These choices keep the current version runnable while leaving explicit seams for the next stage.
