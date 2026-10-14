# Melissa learning library

This directory is a small, reviewed authoring library, not an archive of textbooks. It contains twelve original scenes, writing guidance for six self-selected levels, and a source catalog with short factual notes. No third-party photographs, illustrations, logos, audio or book passages are bundled.

- `scenes/`: original scenarios grouped by everyday, travel and work goals. Each includes a reading, dialogue, useful expressions, three checked questions and three speaking objectives.
- `authoring.ts`: converts the compact scene representation into the public material contract. Each question records its correct answer directly; the helper places it among the distractors and derives its answer index.
- `guidance.ts`: original level-sensitive writing instructions and pedagogical constraints.
- `sources.ts`: attribution, use scope, source URL, rights-policy URL, review date and factual notes.
- `seeds.ts`: a single registry used by retrieval and coverage tests.

The original project content follows the repository's Apache-2.0 license. Third-party facts and reference links retain the separate notices in the catalog. Inclusion does not imply endorsement by a source organization.

## Reviewed sources

Sources were inspected on October 15, 2026. Only the short original notes in `sources.ts` enter the generation context. The complete source pages are not stored or downloaded at runtime.

| Source                                                                                                                       | Stored material and use scope                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [NARA plain-language principles](https://www.archives.gov/open/plain-writing/10-principles.html)                             | Two paraphrased teaching notes. NARA's [use policy](https://www.archives.gov/global-pages/privacy.html) places its own U.S. Government works under CC0 1.0 for worldwide reuse; its archives can contain separately restricted works, which are not imported.                                   |
| [NPS wildlife guidance](https://www.nps.gov/subjects/watchingwildlife/7ways.htm)                                             | Two factual notes about checking local guidance and observing from a distance. The [NPS ownership policy](https://www.nps.gov/aboutus/disclaimer.htm) distinguishes NPS-created public-domain content from protected third-party content and marks. No claim to original U.S. Government works. |
| [NASA Earth facts](https://science.nasa.gov/earth/facts/)                                                                    | Three basic facts in two original notes. NASA's [educational-use guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) requires source acknowledgement and excludes implied endorsement and third-party rights. No media or brand assets are imported.                            |
| [Council of Europe CEFR levels](https://www.coe.int/en/web/common-european-framework-reference-languages/level-descriptions) | Reference link for A1–C2 naming only. No descriptors or teaching passages are copied, and this reference does not enter the model's factual context.                                                                                                                                            |

## Add a scene

1. Write an original scene in the relevant goal file using `scene(...)`. Give it a stable ID, useful topic tags and the level range for its authored version.
2. Include a concise context, 4–8 dialogue turns, 3–6 vocabulary items, 3–5 questions and exactly three speaking prompts.
3. Ensure every question has one unambiguous correct answer in the reading or dialogue. Read each explanation against that answer; keep distractors plausible without creating a second correct answer.
4. Reference catalog source IDs only when the scene uses those factual notes. Add a reviewed catalog record before introducing a new external source. Record permissions separately from the source page, and do not assume that every work hosted by a government agency is reusable.
5. Run `npx vitest run tests/learning.test.ts` and review the generated lesson at both ends of the intended level range. Bump `KNOWLEDGE_VERSION` when changing teaching content.

The AI adapts the selected seed to the learner's requested topic and level. The explicitly labelled demo provider returns the authored scene, whose target range may span two adjacent levels; it does not invent new content or claim exact CEFR calibration. Neither the authored seeds nor generated material is a certified proficiency assessment.
