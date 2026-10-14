import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { AppError, assertRevision } from "@/domain/errors";
import { lessonsFor, nextObjective } from "@/domain/curriculum";
import { buildTeachingContext, compressMemory } from "@/domain/prompt";
import {
  guardResultSchema,
  profileSchema,
  sendMessageSchema,
  teacherResultSchema,
} from "@/domain/models";
import {
  generateMaterialSchema,
  materialToLesson,
} from "@/domain/learning/models";
import type { GenerateMaterialInput } from "@/domain/learning/models";
import { MaterialService } from "./learning/service";
import { knowledgeOverview } from "./learning/knowledge";
import type { InferenceCoordinator } from "./inference/coordinator";
import type { LearnerState, Profile, Snapshot } from "@/domain/models";
import type {
  GuardProvider,
  LearnerRepository,
  TeacherProvider,
} from "@/domain/ports";

export const MAX_SESSION_TURNS = 40;
export const MAX_SESSIONS = 100;
const defaultCapabilities = {
  teacher: "demo",
  materialGeneration: true,
  speechToText: false,
  textToSpeech: false,
  accounts: false,
  billing: false,
} as const;
export function validateInput(text: string) {
  if (
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|<\|(?:im_start|im_end|endoftext)\|>|<\/?(?:system|developer)\b[^>]*>/i.test(
      text,
    )
  ) {
    throw new AppError(
      "INPUT_BLOCKED",
      "Please use ordinary text for your English practice.",
      422,
    );
  }
}
export class Orchestrator {
  constructor(
    private readonly repository: LearnerRepository,
    private readonly guard: GuardProvider,
    private readonly teacher: TeacherProvider,
    private readonly options: {
      dailyUnitLimit: number;
      timeoutMs: number;
      now?: () => Date;
      teacherKind?: Snapshot["capabilities"]["teacher"];
      materials?: MaterialService;
      inference?: InferenceCoordinator;
    },
  ) {}
  private now() {
    return (this.options.now ?? (() => new Date()))();
  }
  private read(owner: string) {
    const state = this.repository.read(owner);
    if (!state)
      throw new AppError(
        "UNAUTHENTICATED",
        "Your guest session expired. Refresh to start again.",
        401,
      );
    return state;
  }
  private save(owner: string, state: LearnerState) {
    const revision = state.revision;
    state.revision += 1;
    this.repository.save(owner, revision, state);
  }
  private session(state: LearnerState, id: string) {
    const session = state.sessions.find((s) => s.id === id);
    if (!session)
      throw new AppError("NOT_FOUND", "Practice session not found.", 404);
    return session;
  }
  snapshot(owner: string): Snapshot {
    const state = this.read(owner);
    const day = this.now().toISOString().slice(0, 10);
    if (state.usage.day !== day) state.usage = { day, units: 0 };
    const lessons = lessonsFor(state.profile?.level ?? "B1");
    lessons.sort(
      (a, b) =>
        Number(b.goal === state.profile?.goal) -
        Number(a.goal === state.profile?.goal),
    );
    return {
      state,
      lessons,
      capabilities: {
        ...defaultCapabilities,
        teacher: this.options.teacherKind ?? "demo",
      },
      knowledge: knowledgeOverview(
        state.profile?.level ?? "B1",
        state.profile?.goal ?? "everyday",
      ),
      aiUsage: this.options.inference?.usage(owner) ?? null,
      dailyUnitLimit: this.options.dailyUnitLimit,
    };
  }
  updateProfile(owner: string, revision: number, input: Profile) {
    return this.change(owner, () => {
      const profile = profileSchema.parse(input);
      validateInput(profile.displayName);
      const state = this.read(owner);
      assertRevision(state.revision, revision);
      state.profile = profile;
      this.save(owner, state);
      return this.snapshot(owner);
    });
  }
  startSession(owner: string, revision: number, lessonId: string) {
    return this.change(owner, () => {
      const state = this.read(owner);
      assertRevision(state.revision, revision);
      if (!state.profile)
        throw new AppError(
          "VALIDATION",
          "Set up your learner profile first.",
          422,
        );
      const active = state.sessions.find((s) => s.status === "active");
      if (active) {
        if (active.lesson.id === lessonId) return this.snapshot(owner);
        throw new AppError(
          "CONFLICT",
          "Finish your current practice before starting another.",
          409,
        );
      }
      if (state.sessions.length >= MAX_SESSIONS)
        throw new AppError(
          "LIMIT_REACHED",
          "This local preview stores up to 100 sessions. Export and clear your data to start again.",
          429,
        );
      const material = state.materials.find((item) => item.id === lessonId);
      const lesson = material
        ? materialToLesson(material)
        : lessonsFor(state.profile.level).find((l) => l.id === lessonId);
      if (!lesson)
        throw new AppError(
          "NOT_FOUND",
          "This lesson is not available for your selected level.",
          404,
        );
      const at = this.now().toISOString();
      state.sessions.unshift({
        id: randomUUID(),
        lesson,
        level: lesson.level,
        status: "active",
        startedAt: at,
        endedAt: null,
        turnCount: 0,
        practicedObjectiveIds: [],
        activeSeconds: 0,
        lastActivityAt: at,
        lastTurnMs: null,
        messages: [
          {
            id: randomUUID(),
            role: "assistant",
            text: `Let's try “${lesson.title}”. ${lesson.objectives[0]!.prompt}`,
            at,
          },
        ],
        memory: {
          archivedMessages: 0,
          practicedObjectiveIds: [],
          redirects: 0,
        },
        receipts: [],
      });
      this.save(owner, state);
      return this.snapshot(owner);
    });
  }
  private async withTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation(controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(
              new AppError(
                "PROVIDER_UNAVAILABLE",
                "The teacher took too long. Your message was not saved. Please try again.",
                503,
              ),
            );
          }, this.options.timeoutMs);
        }),
      ]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        "The teacher is unavailable. Your message was not saved. Please try again.",
        503,
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async sendMessage(
    owner: string,
    sessionId: string,
    raw: { revision: number; requestId: string; text: string },
  ) {
    const input = sendMessageSchema.parse(raw);
    validateInput(input.text);
    const state = this.read(owner);
    const session = this.session(state, sessionId);
    // Replay is checked before revision and completion, so a lost response is safely retried.
    const replay = session.receipts.find(
      (r) => r.requestId === input.requestId,
    );
    if (replay) {
      if (replay.text !== input.text)
        throw new AppError(
          "CONFLICT",
          "This request identifier was already used for another message.",
          409,
        );
      return this.snapshot(owner);
    }
    assertRevision(state.revision, input.revision);
    if (session.status !== "active")
      throw new AppError("CONFLICT", "This practice is already finished.", 409);
    if (session.turnCount >= MAX_SESSION_TURNS)
      throw new AppError(
        "LIMIT_REACHED",
        "You've reached 40 turns. Finish this practice to start a new one.",
        429,
      );
    if (!state.profile)
      throw new AppError(
        "VALIDATION",
        "Set up your learner profile first.",
        422,
      );
    const day = this.now().toISOString().slice(0, 10);
    if (state.usage.day !== day) state.usage = { day, units: 0 };
    // A bounded demo meter. Real adapters must replace this with reserved/reconciled provider usage.
    const units = Math.ceil(input.text.length / 4) + 100;
    if (
      !this.options.inference &&
      state.usage.units + units > this.options.dailyUnitLimit
    )
      throw new AppError(
        "LIMIT_REACHED",
        "Today's demo allowance is used up. It resets at midnight UTC.",
        429,
      );
    const started = performance.now();
    const operation = () =>
      this.withTimeout(async (signal) => {
        const intent = guardResultSchema.parse(
          await this.guard.classify(input.text, signal),
        );
        const answer = teacherResultSchema.parse(
          await this.teacher.respond(
            buildTeachingContext(
              state.profile!,
              session,
              input.text,
              intent.intent,
            ),
            signal,
          ),
        );
        return { ...answer, intent: intent.intent };
      });
    const commit = (result: {
      text: string;
      intent: "practice" | "help" | "redirect";
    }) => {
      const objective = nextObjective(session);
      // Participation is recorded after inference sees the objective actually attempted.
      if (
        result.intent === "practice" &&
        input.text.split(/\s+/u).length >= 3 &&
        !session.practicedObjectiveIds.includes(objective.id)
      )
        session.practicedObjectiveIds.push(objective.id);
      if (result.intent === "redirect") session.memory.redirects += 1;
      const now = this.now();
      const at = now.toISOString();
      const messageId = randomUUID();
      session.messages.push(
        { id: randomUUID(), role: "user", text: input.text, at },
        { id: messageId, role: "assistant", text: result.text, at },
      );
      session.receipts.push({
        requestId: input.requestId,
        text: input.text,
        messageId,
      });
      session.turnCount += 1;
      session.activeSeconds += Math.max(
        0,
        Math.min(
          120,
          Math.round(
            (now.getTime() - Date.parse(session.lastActivityAt)) / 1000,
          ),
        ),
      );
      session.lastActivityAt = at;
      session.lastTurnMs = Math.round(performance.now() - started);
      compressMemory(session);
      if (!this.options.inference) state.usage.units += units;
      this.save(owner, state);
      return this.snapshot(owner);
    };
    return this.options.inference
      ? this.options.inference.run(
          {
            owner,
            requestId: input.requestId,
            revision: input.revision,
            fingerprint: this.fingerprint({
              action: "turn",
              sessionId,
              text: input.text,
              revision: input.revision,
            }),
          },
          operation,
          commit,
        )
      : commit(await operation());
  }
  private fingerprint(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
  async generateMaterial(owner: string, raw: GenerateMaterialInput) {
    const input = generateMaterialSchema.parse(raw);
    validateInput(input.topic);
    const state = this.read(owner);
    const replay = state.materials.find(
      (item) => item.requestId === input.requestId,
    );
    if (replay) {
      if (replay.requestedTopic !== input.topic || replay.goal !== input.goal)
        throw new AppError(
          "CONFLICT",
          "This request identifier was already used for another lesson.",
          409,
        );
      return this.snapshot(owner);
    }
    assertRevision(state.revision, input.revision);
    if (!state.profile)
      throw new AppError(
        "VALIDATION",
        "Set up your learner profile first.",
        422,
      );
    if (state.materials.length >= 30)
      throw new AppError(
        "LIMIT_REACHED",
        "Your library holds up to 30 custom lessons. Export and clear your data to start a new collection.",
        429,
      );
    const service = this.options.materials;
    if (!service)
      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        "Lesson creation is not configured yet.",
        503,
      );
    const operation = () =>
      this.withTimeout((signal) =>
        service.create(
          {
            level: state.profile!.level,
            goal: input.goal,
            topic: input.topic,
            requestId: input.requestId,
          },
          signal,
        ),
      );
    const commit = (
      material: Awaited<ReturnType<MaterialService["create"]>>,
    ) => {
      state.materials.unshift(material);
      this.save(owner, state);
      return this.snapshot(owner);
    };
    return this.options.inference
      ? this.options.inference.run(
          {
            owner,
            requestId: input.requestId,
            revision: input.revision,
            fingerprint: this.fingerprint({
              action: "material",
              goal: input.goal,
              topic: input.topic,
              level: state.profile.level,
              revision: input.revision,
            }),
          },
          operation,
          commit,
        )
      : commit(await operation());
  }
  finishSession(owner: string, id: string, revision: number) {
    return this.change(owner, () => {
      const state = this.read(owner);
      const session = this.session(state, id);
      if (session.status === "completed") return this.snapshot(owner);
      assertRevision(state.revision, revision);
      session.status = "completed";
      session.endedAt = this.now().toISOString();
      this.save(owner, state);
      return this.snapshot(owner);
    });
  }
  deleteData(owner: string, revision: number) {
    this.change(owner, () => this.repository.delete(owner, revision));
  }
  private change<T>(owner: string, operation: () => T): T {
    return this.options.inference
      ? this.options.inference.idle(owner, operation)
      : operation();
  }
}
