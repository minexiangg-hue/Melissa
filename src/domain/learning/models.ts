import { z } from "zod";
import { levelSchema, mutationSchema } from "../models";
import type { Goal, Lesson, Level, Objective } from "../models";

const shortText = (max: number) => z.string().trim().min(1).max(max);
export const materialGoalSchema = z.enum(["everyday", "travel", "work"]);
export const materialProviderSchema = z.enum([
  "demo",
  "openai-compatible",
  "codex",
]);
export type MaterialProviderKind = z.infer<typeof materialProviderSchema>;
export const generateMaterialSchema = mutationSchema.extend({
  requestId: z.uuid(),
  topic: z.string().trim().max(120).default(""),
  goal: materialGoalSchema,
});
export type GenerateMaterialInput = z.infer<typeof generateMaterialSchema>;

/** Shape-only schema is also sent to structured-output providers. */
export const materialDraftSchema = z
  .object({
    title: shortText(90),
    summary: shortText(260),
    reading: z.object({ title: shortText(90), text: shortText(3600) }).strict(),
    dialogue: z
      .array(
        z.object({ speaker: shortText(30), text: shortText(500) }).strict(),
      )
      .min(4)
      .max(8),
    vocabulary: z
      .array(
        z
          .object({
            term: shortText(70),
            meaning: shortText(180),
            example: shortText(240),
          })
          .strict(),
      )
      .min(3)
      .max(6),
    exercises: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
            prompt: shortText(300),
            options: z.array(shortText(220)).min(3).max(4),
            answerIndex: z.number().int().min(0).max(3),
            explanation: shortText(450),
          })
          .strict(),
      )
      .min(3)
      .max(5),
    objectives: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/),
            title: shortText(90),
            prompt: shortText(400),
            example: shortText(300),
          })
          .strict(),
      )
      .length(3),
  })
  .strict();
export type MaterialDraft = z.infer<typeof materialDraftSchema>;
export const learningMaterialSchema = materialDraftSchema.extend({
  id: z.string().regex(/^material-[a-f0-9-]{36}$/),
  requestId: z.uuid(),
  createdAt: z.iso.datetime(),
  level: levelSchema,
  goal: materialGoalSchema,
  topic: z.string().max(120),
  requestedTopic: z.string().max(120),
  provider: materialProviderSchema,
  sourceIds: z.array(z.string()).min(1).max(5),
});
export type LearningMaterial = z.infer<typeof learningMaterialSchema>;

export interface KnowledgeSource {
  id: string;
  title: string;
  publisher: string;
  url: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  notes: string[];
  usage: "original" | "facts-only" | "reference-only";
  reviewedAt: string;
}
export interface MaterialSeed {
  id: string;
  title: string;
  goal: Goal;
  levels: Level[];
  description: string;
  topic: string;
  tags: string[];
  focus: string;
  sourceIds: string[];
  draft: MaterialDraft;
}
export interface MaterialSuggestion {
  id: string;
  title: string;
  goal: Goal;
  description: string;
  topic: string;
}
export interface KnowledgeOverview {
  version: string;
  sourceCount: number;
  seedCount: number;
  sources: KnowledgeSource[];
  suggestions: MaterialSuggestion[];
}
export interface MaterialContext {
  level: Level;
  goal: Goal;
  topic: string;
  levelGuidance: string;
  teachingRules: string[];
  sources: Pick<KnowledgeSource, "id" | "title" | "notes">[];
  seed: MaterialSeed;
}
export interface MaterialProvider {
  readonly kind: MaterialProviderKind;
  generate(
    context: Readonly<MaterialContext>,
    signal: AbortSignal,
  ): Promise<MaterialDraft>;
}

/** Run after JSON/schema parsing: relationships cannot be expressed in JSON Schema. */
export function validateMaterialDraft(input: unknown): MaterialDraft {
  const material = materialDraftSchema.parse(input);
  const unique = (values: string[]) =>
    new Set(values.map((v) => v.toLowerCase())).size === values.length;
  if (!unique(material.objectives.map((item) => item.id)))
    throw new Error("Material objective IDs must be unique.");
  if (!unique(material.exercises.map((item) => item.id)))
    throw new Error("Material exercise IDs must be unique.");
  if (!unique(material.vocabulary.map((item) => item.term)))
    throw new Error("Material vocabulary must be distinct.");
  for (const exercise of material.exercises) {
    if (exercise.answerIndex >= exercise.options.length)
      throw new Error("Material answer must reference an available option.");
    if (!unique(exercise.options))
      throw new Error("Material exercise options must be distinct.");
  }
  return material;
}

export function materialToLesson(material: LearningMaterial): Lesson {
  return {
    id: material.id,
    title: material.title,
    description: material.summary,
    goal: material.goal,
    level: material.level,
    objectives: structuredClone(material.objectives) satisfies Objective[],
    material: structuredClone({
      reading: material.reading,
      dialogue: material.dialogue,
      vocabulary: material.vocabulary,
      exercises: material.exercises,
      sourceIds: material.sourceIds,
    }),
  };
}
