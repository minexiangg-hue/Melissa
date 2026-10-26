import { z } from "zod";
import type { LearningMaterial, KnowledgeOverview } from "./learning/models";

export const levelSchema = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
export type Level = z.infer<typeof levelSchema>;
export const profileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(40),
    nativeLanguage: z.enum(["Chinese", "English", "Other"]),
    level: levelSchema,
    goal: z.enum(["everyday", "travel", "work"]),
    dailyMinutes: z.union([z.literal(5), z.literal(10), z.literal(15)]),
  })
  .strict();
export type Profile = z.infer<typeof profileSchema>;
export type Goal = Profile["goal"];

export interface Objective {
  id: string;
  title: string;
  prompt: string;
  example: string;
}
export interface Lesson {
  id: string;
  title: string;
  description: string;
  goal: Goal;
  level: Level;
  objectives: Objective[];
  material?: Pick<
    LearningMaterial,
    "reading" | "dialogue" | "vocabulary" | "exercises" | "sourceIds"
  >;
}
export interface Message {
  id: string;
  role: "assistant" | "user";
  text: string;
  at: string;
}
export interface TurnReceipt {
  requestId: string;
  text: string;
  messageId: string;
}
export interface Memory {
  archivedMessages: number;
  practicedObjectiveIds: string[];
  redirects: number;
}
export interface Session {
  id: string;
  lesson: Lesson;
  level: Level;
  status: "active" | "completed";
  startedAt: string;
  endedAt: string | null;
  turnCount: number;
  practicedObjectiveIds: string[];
  messages: Message[];
  memory: Memory;
  receipts: TurnReceipt[];
  activeSeconds: number;
  lastActivityAt: string;
  lastTurnMs: number | null;
}
export interface LearnerState {
  schemaVersion: 1;
  revision: number;
  profile: Profile | null;
  sessions: Session[];
  materials: LearningMaterial[];
  usage: { day: string; units: number };
}
export interface Capabilities {
  teacher: "demo" | "openai-compatible" | "codex";
  materialGeneration: boolean;
  speechToText: false;
  textToSpeech: boolean;
  accounts: false;
  billing: false;
}
export interface Snapshot {
  state: LearnerState;
  lessons: Lesson[];
  capabilities: Capabilities;
  dailyUnitLimit: number;
  knowledge: KnowledgeOverview;
  aiUsage: {
    requests: number;
    limit: number;
    inputTokens: number;
    outputTokens: number;
    unknownUsageRequests: number;
  } | null;
}
export const mutationSchema = z
  .object({ revision: z.number().int().nonnegative() })
  .strict();
export const updateProfileSchema = mutationSchema.extend({
  profile: profileSchema,
});
export const startSessionSchema = mutationSchema.extend({
  lessonId: z.string().min(1).max(80),
});
export const sendMessageSchema = mutationSchema.extend({
  requestId: z.uuid(),
  text: z.string().trim().min(1).max(2000),
});
export const teacherResultSchema = z
  .object({ text: z.string().trim().min(1).max(1600) })
  .strict();
export const guardResultSchema = z
  .object({ intent: z.enum(["practice", "help", "redirect"]) })
  .strict();
export type GuardResult = z.infer<typeof guardResultSchema>;
export function freshState(day: string): LearnerState {
  return {
    schemaVersion: 1,
    revision: 0,
    profile: null,
    sessions: [],
    materials: [],
    usage: { day, units: 0 },
  };
}
