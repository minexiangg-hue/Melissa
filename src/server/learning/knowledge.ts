import "server-only";
import type { Goal, Level } from "@/domain/models";
import type {
  KnowledgeOverview,
  MaterialContext,
  MaterialSeed,
} from "@/domain/learning/models";
import {
  levelGuidance,
  teachingRules,
} from "../../../content/learning/guidance";
import { knowledgeSources } from "../../../content/learning/sources";
import { materialSeeds } from "../../../content/learning/seeds";

export const KNOWLEDGE_VERSION = "2026.10.1";
const levels: Level[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
const stopWords = new Set(
  "about after again also and are because before both can could does for from have how into more new not off one only our out over should some than that the their them there these they this through today too two use used using was were what when where which who why will with would your".split(
    " ",
  ),
);
function words(text: string) {
  return [...new Set(text.toLowerCase().match(/[a-z]{3,}/g) ?? [])].filter(
    (word) => !stopWords.has(word),
  );
}
function rankSeed(seed: MaterialSeed, level: Level, topic: string) {
  const text =
    `${seed.title} ${seed.tags.join(" ")} ${seed.description}`.toLowerCase();
  const overlap = words(topic).reduce(
    (total, word) => total + Number(text.includes(word)),
    0,
  );
  const distance = Math.min(
    ...seed.levels.map((candidate) =>
      Math.abs(levels.indexOf(candidate) - levels.indexOf(level)),
    ),
  );
  return overlap * 12 - distance * 3;
}

/** Goal is a hard filter; topic relevance and level distance order the reviewed seeds. */
export function retrieveSeed(
  level: Level,
  goal: Goal,
  topic = "",
): MaterialSeed {
  const seed = materialSeeds
    .filter((candidate) => candidate.goal === goal)
    .toSorted(
      (a, b) => rankSeed(b, level, topic) - rankSeed(a, level, topic),
    )[0];
  if (!seed) throw new Error("No curriculum seed is available for this goal.");
  return structuredClone(seed);
}

export function knowledgeOverview(
  level: Level = "B1",
  goal: Goal = "everyday",
): KnowledgeOverview {
  const suggestions = materialSeeds
    .toSorted(
      (a, b) =>
        Number(b.goal === goal) - Number(a.goal === goal) ||
        rankSeed(b, level, "") - rankSeed(a, level, ""),
    )
    .map(({ id, title, goal: seedGoal, description, topic }) => ({
      id,
      title,
      goal: seedGoal,
      description,
      topic,
    }));
  return {
    version: KNOWLEDGE_VERSION,
    sourceCount: knowledgeSources.filter(
      (source) => source.usage !== "reference-only",
    ).length,
    seedCount: materialSeeds.length,
    sources: structuredClone(knowledgeSources),
    suggestions,
  };
}

export function buildMaterialContext(
  level: Level,
  goal: Goal,
  topic: string,
): MaterialContext {
  const seed = retrieveSeed(level, goal, topic);
  const sourceIds = new Set(seed.sourceIds);
  // A science topic can supply facts even when its scene is a workplace conversation.
  for (const source of knowledgeSources) {
    if (source.usage !== "facts-only") continue;
    const sourceWords = new Set(
      words(`${source.title} ${source.notes.join(" ")}`),
    );
    if (words(topic).some((word) => sourceWords.has(word)))
      sourceIds.add(source.id);
  }
  const sources = knowledgeSources
    .filter(
      (source) => sourceIds.has(source.id) && source.usage !== "reference-only",
    )
    .map(({ id, title, notes }) => ({ id, title, notes: [...notes] }));
  return {
    level,
    goal,
    topic: topic || seed.topic,
    levelGuidance: levelGuidance[level],
    teachingRules: [...teachingRules],
    sources,
    seed,
  };
}
