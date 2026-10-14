# Learning materials and knowledge

Melissa can create a short, original learning set for a guest's level, goal and optional topic, then use that set as a conversation lesson. The existing plan explicitly prefers curriculum-writing guidance to reproducing textbooks. The implementation follows that approach through a reviewed local library and a replaceable generation interface.

## Generation path

1. The HTTP boundary validates a revision, request ID, goal and optional topic. The orchestrator loads the profile using the guest's server-derived owner key.
2. Retrieval selects a reviewed scene within the requested goal. Topic overlap and distance from the selected level order the candidates. Relevant factual notes may also be included across goals, for example an ocean-related presentation at work.
3. The context contains the requested level, goal and topic, original writing guidance, one authored scene and reviewed source notes. It contains no guest credential, owner key, display name, unrelated conversations or repository interface.
4. `AiMaterialProvider` uses the shared structured generator. The same material contract works with either the external API or Codex adapter. `DemoMaterialProvider` is a separate, clearly identified authored-content fallback.
5. The material schema bounds every text and collection. Additional validation rejects duplicate vocabulary, duplicate objective/question IDs, duplicate options and answer indices outside the options. The model is instructed to solve its questions and cross-check its explanations before returning the result.
6. The service assigns the ID, creation timestamp, original request ID, provider kind and source IDs. Model output cannot supply these fields. `requestedTopic` retains the normalized original request, including an empty default, while `topic` is the display topic selected from the request or seed.
7. The orchestrator owns cancellation deadlines, quota, replay, ownership and the atomic save. A generated set is part of the same guest aggregate as the profile and conversation sessions, and therefore participates in export, expiry and deletion.

Starting a conversation from a material copies its three objectives and a detached material snapshot (reading, dialogue, vocabulary, exercises and source IDs) into the ordinary lesson contract. The tutor receives that snapshot, so it can discuss details and explain answers from the generated material. Objectives include enough context to make sense without the learner reopening the reading. The active session remains a snapshot even if profile preferences later change.

## Meaning of validation

Structural validation ensures a complete, bounded payload and a valid answer key. Authored seed questions were reviewed against their readings and dialogues. AI generation also receives explicit pedagogical and answer-consistency instructions. These checks do not prove that every future generated answer or explanation is semantically correct. Improving that assurance should use a reviewed evaluation set, sampled teacher review and, where warranted, an independent verifier with a measured rejection rate; avoid presenting participation as mastery.

A learner's selected A1–C2 level is a writing target, not a measured placement result. Material generation uses original guidance for vocabulary, length, task complexity and register. The UI can display the writing target, but should not call completion a CEFR certification.

## Knowledge provenance

See [the content library](../content/learning/README.md) for licenses, source links and the authoring process. `sourceIds` identify the sources supplied to the generator, not a claim that every sentence quotes one of those pages. All stored passages and dialogues are original. Source notes use facts rather than copied textbook expression; the CEFR reference is metadata only.

The knowledge overview reports the number of usable sources separately from reference-only catalog records. It exposes attribution and suggested topics for the library interface. Retrieval returns detached values so callers cannot mutate the shared catalog.

No runtime web scrape, arbitrary URL fetch or embedding service is required for this version. New retrieval adapters can retain `MaterialContext` and `MaterialProvider` while replacing the local selector. Any future ingestion process should preserve source identity, use scope, license evidence, review date and versioned authoring rules.

## Key files and verification

- `src/domain/learning/models.ts`: transport-neutral schemas and lesson conversion.
- `src/server/learning/knowledge.ts`: deterministic, bounded retrieval and public catalog.
- `src/server/learning/providers.ts`: AI and authored demo adapters.
- `src/server/learning/service.ts`: creation and provenance boundary.
- `content/learning/`: editable source catalog, writing guidance and original scenes.
- `tests/learning.test.ts`: curriculum coverage, provenance, detached reads, invalid answer keys, malformed payloads, cancellation and provider isolation.

Run `npx vitest run tests/learning.test.ts` after content or generation changes. Integration tests must additionally cover API ownership, replay with a conflicting request, persistent reload, export/delete, generated-lesson conversation and timeout behavior.

For an opt-in real generation check, run `MELISSA_LIVE_CODEX=1 npx vitest run tests/learning.live.test.ts`, or set `MELISSA_LIVE_API=1` with the configured external API credentials. These checks are skipped in ordinary CI and incur a provider request when enabled. To inspect the complete generated output, set `MELISSA_LIVE_ARTIFACT_DIR` to a private local directory. Review the reading, dialogue and every answer together; passing schema checks alone is not a pedagogical review.
