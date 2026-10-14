import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError } from "@/domain/errors";
import { levelSchema } from "@/domain/models";
import {
  learningMaterialSchema,
  materialGoalSchema,
  validateMaterialDraft,
} from "@/domain/learning/models";
import type {
  LearningMaterial,
  MaterialProvider,
} from "@/domain/learning/models";
import { buildMaterialContext } from "./knowledge";

const creationSchema = z
  .object({
    level: levelSchema,
    goal: materialGoalSchema,
    topic: z.string().trim().max(120),
    requestId: z.uuid(),
  })
  .strict();
export type MaterialCreation = z.infer<typeof creationSchema>;

/** No identity or persistence authority; the orchestrator owns quota, replay and CAS. */
export class MaterialService {
  constructor(
    private readonly provider: MaterialProvider,
    private readonly now: () => Date = () => new Date(),
  ) {}
  get kind() {
    return this.provider.kind;
  }
  async create(
    input: MaterialCreation,
    signal: AbortSignal,
  ): Promise<LearningMaterial> {
    const request = creationSchema.parse(input);
    const context = buildMaterialContext(
      request.level,
      request.goal,
      request.topic,
    );
    signal.throwIfAborted();
    try {
      const raw = await this.provider.generate(context, signal);
      signal.throwIfAborted();
      const draft = validateMaterialDraft(raw);
      return learningMaterialSchema.parse({
        ...draft,
        id: `material-${randomUUID()}`,
        requestId: request.requestId,
        createdAt: this.now().toISOString(),
        level: request.level,
        goal: request.goal,
        topic: context.topic,
        requestedTopic: request.topic,
        provider: this.provider.kind,
        sourceIds: context.sources.map((source) => source.id),
      });
    } catch (error) {
      if (signal.aborted || error instanceof AppError) throw error;
      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        "Melissa couldn't prepare a complete practice set. Please try again.",
        503,
      );
    }
  }
}
