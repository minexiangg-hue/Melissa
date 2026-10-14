import { teachingGuidelines, nextObjective } from "./curriculum";
import { AppError } from "./errors";
import type { Profile, Session, GuardResult } from "./models";
import type { TeachingContext } from "./ports";

export const RECENT_MESSAGE_LIMIT = 12;
/** Leaves room for provider instructions and envelopes within the 64 KiB transport cap. */
export const TEACHING_CONTEXT_BYTE_LIMIT = 48 * 1024;
const encoder = new TextEncoder();
const omittedContextNotice =
  "Some context was omitted for size: earlier messages or learning material may be incomplete. Do not reconstruct or invent omitted details. If a requested detail is not present, say that you do not have it and ask the learner to share it.";
function contextBytes(context: TeachingContext) {
  return encoder.encode(JSON.stringify(context)).byteLength;
}
function fits(context: TeachingContext) {
  return contextBytes(context) <= TEACHING_CONTEXT_BYTE_LIMIT;
}
function contextTooLarge(): never {
  throw new AppError(
    "PROVIDER_UNAVAILABLE",
    "This lesson contains too much required context. Please start a new practice.",
    503,
  );
}

/** All changes affect a detached working copy, never the stored session or material. */
function boundContext(context: TeachingContext): TeachingContext {
  if (fits(context)) return context;
  context.system += `\n${omittedContextNotice}`;
  while (context.recentMessages.length && !fits(context))
    context.recentMessages.shift();
  if (fits(context)) return context;

  const material = context.lesson.material;
  if (!material) contextTooLarge();
  // Keep the reading and its useful expressions longest; answer keys are auxiliary.
  for (const key of ["exercises", "dialogue", "vocabulary"] as const) {
    material[key] = [];
    if (fits(context)) return context;
  }

  // Count the serialized JSON, including escaping. Code points avoid splitting pairs.
  const reading = [...material.reading.text];
  material.reading.text = "";
  if (!fits(context)) contextTooLarge();
  let low = 0;
  let high = reading.length;
  const excerpt = (length: number) =>
    length
      ? `${reading.slice(0, length).join("")}${length < reading.length ? "…" : ""}`
      : "";
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    material.reading.text = excerpt(middle);
    if (fits(context)) low = middle;
    else high = middle - 1;
  }
  material.reading.text = excerpt(low);
  return context;
}

export function buildTeachingContext(
  profile: Profile,
  session: Session,
  input: string,
  intent: GuardResult["intent"],
): TeachingContext {
  return boundContext({
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
  });
}
/** Derived memory stores objective IDs and counts, never learner-authored instructions. */
export function compressMemory(session: Session) {
  const removed = Math.max(0, session.messages.length - RECENT_MESSAGE_LIMIT);
  session.memory.archivedMessages += removed;
  session.memory.practicedObjectiveIds = [...session.practicedObjectiveIds];
  session.messages = session.messages.slice(-RECENT_MESSAGE_LIMIT);
}
