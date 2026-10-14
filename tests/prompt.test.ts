import { describe, expect, it } from "vitest";
import type { Message, Profile, Session } from "@/domain/models";
import { lessonsFor } from "@/domain/curriculum";
import {
  buildTeachingContext,
  RECENT_MESSAGE_LIMIT,
  TEACHING_CONTEXT_BYTE_LIMIT,
} from "@/domain/prompt";
import type { TeachingContext } from "@/domain/ports";
import { materialSeeds } from "../content/learning/seeds";

const profile: Profile = {
  displayName: "Private name",
  nativeLanguage: "Chinese",
  goal: "work",
  level: "B1",
  dailyMinutes: 10,
};
function session(): Session {
  const draft = structuredClone(
    materialSeeds.find((seed) => seed.id === "work-project-update")!.draft,
  );
  return {
    id: "session-1",
    lesson: {
      ...lessonsFor("B1")[2]!,
      title: draft.title,
      description: draft.summary,
      objectives: draft.objectives,
      material: {
        reading: draft.reading,
        dialogue: draft.dialogue,
        vocabulary: draft.vocabulary,
        exercises: draft.exercises,
        sourceIds: ["melissa-original", "nara-plain-language"],
      },
    },
    level: "B1",
    status: "active",
    startedAt: "2026-10-15T12:00:00Z",
    endedAt: null,
    turnCount: 12,
    practicedObjectiveIds: [draft.objectives[0]!.id],
    messages: [],
    memory: {
      archivedMessages: 8,
      practicedObjectiveIds: [draft.objectives[0]!.id],
      redirects: 0,
    },
    receipts: [],
    activeSeconds: 45,
    lastActivityAt: "2026-10-15T12:01:00Z",
    lastTurnMs: 600,
  };
}
function messages(text: string, count = RECENT_MESSAGE_LIMIT): Message[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `message-${i}`,
    role: i % 2 ? "user" : "assistant",
    text,
    at: "2026-10-15T12:00:00Z",
  }));
}
function bytes(context: TeachingContext) {
  return new TextEncoder().encode(JSON.stringify(context)).byteLength;
}
function core(context: Pick<TeachingContext, "lesson">) {
  const lesson = structuredClone(context.lesson);
  delete lesson.material;
  return lesson;
}

describe("byte-bounded teaching context", () => {
  it("preserves normal generated material and the latest twelve messages on a detached copy", () => {
    const stored = session();
    stored.messages = messages(
      "The draft is ready. Can you review it by Thursday?",
      16,
    );
    const before = structuredClone(stored);
    const context = buildTeachingContext(
      profile,
      stored,
      "Can you explain the second exercise?",
      "help",
    );
    expect(context.recentMessages.map((item) => item.id)).toEqual(
      stored.messages.slice(-12).map((item) => item.id),
    );
    expect(context.lesson.material).toEqual(stored.lesson.material);
    expect(context.system).not.toContain("omitted for size");
    expect(bytes(context)).toBeLessThanOrEqual(TEACHING_CONTEXT_BYTE_LIMIT);
    context.lesson.material!.reading.text = "Changed by the provider";
    context.recentMessages[0]!.text = "Changed by the provider";
    context.memory.practicedObjectiveIds.length = 0;
    expect(stored).toEqual(before);
    expect(JSON.stringify(context)).not.toContain(profile.displayName);
  });

  it("drops the oldest long Unicode messages first while preserving input and required lesson details", () => {
    const stored = session();
    stored.messages = messages("学".repeat(2000));
    const before = structuredClone(stored);
    const input = "🪷".repeat(1000);
    const context = buildTeachingContext(profile, stored, input, "practice");
    expect(bytes(context)).toBeLessThanOrEqual(TEACHING_CONTEXT_BYTE_LIMIT);
    expect(context.recentMessages.length).toBeGreaterThan(0);
    expect(context.recentMessages.length).toBeLessThan(12);
    expect(context.recentMessages).toEqual(
      stored.messages.slice(-context.recentMessages.length),
    );
    expect(context.input).toBe(input);
    expect(core(context)).toEqual(core({ lesson: stored.lesson }));
    expect(context.objective).toEqual(stored.lesson.objectives[1]);
    expect(context.lesson.material).toEqual(stored.lesson.material);
    expect(context.system).toContain(
      "Do not reconstruct or invent omitted details",
    );
    expect(stored).toEqual(before);
  });

  it("budgets JSON escaping rather than only the raw character length", () => {
    const stored = session();
    stored.messages = messages('"\\\n'.repeat(666));
    const input = "Please help me phrase that clearly.";
    const context = buildTeachingContext(profile, stored, input, "help");
    expect(context.recentMessages.length).toBeLessThan(12);
    expect(context.input).toBe(input);
    expect(bytes(context)).toBeLessThanOrEqual(TEACHING_CONTEXT_BYTE_LIMIT);
  });

  it("omits answer keys before dialogue, vocabulary or reading when material alone is large", () => {
    const stored = session();
    const material = stored.lesson.material!;
    material.reading.text = "学".repeat(3600);
    material.dialogue = Array.from({ length: 8 }, () => ({
      speaker: "Speaker",
      text: "学".repeat(500),
    }));
    material.vocabulary = Array.from({ length: 6 }, (_, i) => ({
      term: `${i}${"学".repeat(69)}`,
      meaning: "学".repeat(180),
      example: "学".repeat(240),
    }));
    material.exercises = Array.from({ length: 5 }, (_, i) => ({
      id: `question-${i}`,
      prompt: "学".repeat(300),
      options: [
        "学".repeat(220),
        "語".repeat(220),
        "文".repeat(220),
        "字".repeat(220),
      ],
      answerIndex: 0,
      explanation: "学".repeat(450),
    }));
    const before = structuredClone(stored);
    const context = buildTeachingContext(
      profile,
      stored,
      "Explain the reading.",
      "help",
    );
    expect(bytes(context)).toBeLessThanOrEqual(TEACHING_CONTEXT_BYTE_LIMIT);
    expect(context.lesson.material!.exercises).toEqual([]);
    expect(context.lesson.material!.dialogue).toEqual(material.dialogue);
    expect(context.lesson.material!.vocabulary).toEqual(material.vocabulary);
    expect(context.lesson.material!.reading).toEqual(material.reading);
    expect(stored).toEqual(before);
  });

  it("bounds unusually large persisted material with a Unicode-safe excerpt only after removing auxiliary sections", () => {
    const stored = session();
    stored.lesson.material!.reading.text = '学🪷"\\'.repeat(20000);
    stored.messages = messages("An older conversation.");
    const before = structuredClone(stored);
    const input = "Please explain only the part you can see.";
    const context = buildTeachingContext(profile, stored, input, "help");
    const material = context.lesson.material!;
    expect(bytes(context)).toBeLessThanOrEqual(TEACHING_CONTEXT_BYTE_LIMIT);
    expect(context.recentMessages).toEqual([]);
    expect(material.exercises).toEqual([]);
    expect(material.dialogue).toEqual([]);
    expect(material.vocabulary).toEqual([]);
    expect(material.reading.text.endsWith("…")).toBe(true);
    expect(material.reading.text.isWellFormed()).toBe(true);
    expect(
      before.lesson.material!.reading.text.startsWith(
        material.reading.text.slice(0, -1),
      ),
    ).toBe(true);
    expect(material.sourceIds).toEqual(before.lesson.material!.sourceIds);
    expect(context.lesson.objectives).toEqual(before.lesson.objectives);
    expect(context.input).toBe(input);
    expect(context.system).toContain("ask the learner to share it");
    expect(stored).toEqual(before);
  });

  it("rejects an impossible required context instead of silently truncating the current input or objectives", () => {
    const stored = session();
    const before = structuredClone(stored);
    expect(() =>
      buildTeachingContext(
        profile,
        stored,
        "a".repeat(TEACHING_CONTEXT_BYTE_LIMIT),
        "practice",
      ),
    ).toThrow("too much required context");
    expect(stored).toEqual(before);
    stored.lesson.objectives[0]!.prompt = "a".repeat(
      TEACHING_CONTEXT_BYTE_LIMIT,
    );
    expect(() =>
      buildTeachingContext(profile, stored, "A short reply", "practice"),
    ).toThrow("too much required context");
    expect(stored.lesson.objectives[0]!.prompt.length).toBe(
      TEACHING_CONTEXT_BYTE_LIMIT,
    );
  });
});
