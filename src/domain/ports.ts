import type {
  GuardResult,
  LearnerState,
  Lesson,
  Memory,
  Message,
  Objective,
  Profile,
} from "./models";

/** All adapters must enforce owner scoping, atomic CAS, and detached reads. */
export interface LearnerRepository {
  create(ownerHash: string, state: LearnerState, expiresAt: number): void;
  read(ownerHash: string): LearnerState | null;
  save(ownerHash: string, expectedRevision: number, next: LearnerState): void;
  delete(ownerHash: string, expectedRevision: number): void;
}
export interface TeachingContext {
  system: string;
  learner: Pick<Profile, "level" | "goal" | "nativeLanguage">;
  lesson: Lesson;
  objective: Objective;
  memory: Memory;
  recentMessages: Message[];
  input: string;
  intent: GuardResult["intent"];
  allObjectivesPracticed: boolean;
}
/** Providers never receive a repository, owner key, cookie, or mutation capability. */
export interface GuardProvider {
  classify(input: string, signal: AbortSignal): Promise<GuardResult>;
}
export interface TeacherProvider {
  respond(
    context: Readonly<TeachingContext>,
    signal: AbortSignal,
  ): Promise<{ text: string }>;
}
export interface SpeechToTextProvider {
  transcribe(
    audio: { bytes: Uint8Array; mimeType: string },
    signal: AbortSignal,
  ): Promise<{ text: string; durationMs: number }>;
}
export interface TextToSpeechProvider {
  synthesize(
    text: string,
    signal: AbortSignal,
  ): Promise<{ audio: ReadableStream<Uint8Array>; mimeType: string }>;
}
