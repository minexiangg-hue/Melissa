import { teachingGuidelines, nextObjective } from "./curriculum";
import type { Profile, Session, GuardResult } from "./models";
import type { TeachingContext } from "./ports";
export const RECENT_MESSAGE_LIMIT = 12;
export function buildTeachingContext(
  profile: Profile,
  session: Session,
  input: string,
  intent: GuardResult["intent"],
): TeachingContext {
  return {
    system: [
      teachingGuidelines.persona,
      ...teachingGuidelines.rules,
      `Current self-reported CEFR level: ${session.level}.`,
    ].join("\n"),
    learner: {
      level: session.level,
      goal: session.lesson.goal,
      nativeLanguage: profile.nativeLanguage,
    },
    lesson: structuredClone(session.lesson),
    objective: structuredClone(nextObjective(session)),
    memory: structuredClone(session.memory),
    recentMessages: structuredClone(
      session.messages.slice(-RECENT_MESSAGE_LIMIT),
    ),
    input,
    intent,
    allObjectivesPracticed:
      session.practicedObjectiveIds.length === session.lesson.objectives.length,
  };
}
/** Derived memory stores objective IDs and counts, never learner-authored instructions. */
export function compressMemory(session: Session) {
  const removed = Math.max(0, session.messages.length - RECENT_MESSAGE_LIMIT);
  session.memory.archivedMessages += removed;
  session.memory.practicedObjectiveIds = [...session.practicedObjectiveIds];
  session.messages = session.messages.slice(-RECENT_MESSAGE_LIMIT);
}
