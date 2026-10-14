import "server-only";
import { z } from "zod";
import { AppError } from "@/domain/errors";

export type GenerationUsage = { inputTokens: number; outputTokens: number };
export interface GenerationRequest<T> {
  name: string;
  system: string;
  input: string;
  schema: z.ZodType<T>;
  maxOutputTokens?: number;
}
export interface GenerationResult<T> {
  data: T;
  usage: GenerationUsage | null;
  requestId?: string;
}
export interface StructuredGenerator {
  readonly kind: "openai-compatible" | "codex";
  generate<T>(
    request: GenerationRequest<T>,
    signal: AbortSignal,
  ): Promise<GenerationResult<T>>;
}
export const MAX_INPUT_BYTES = 64 * 1024;
export const MAX_OUTPUT_BYTES = 64 * 1024;
export function providerUnavailable() {
  return new AppError(
    "PROVIDER_UNAVAILABLE",
    "Melissa could not finish this response. Please try again in a moment.",
    503,
  );
}
export function prepareRequest<T>(request: GenerationRequest<T>) {
  if (
    !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(request.name) ||
    !request.system.trim() ||
    !request.input.trim() ||
    Buffer.byteLength(request.system + request.input, "utf8") > MAX_INPUT_BYTES
  )
    throw providerUnavailable();
  const maxOutputTokens = request.maxOutputTokens ?? 2048;
  if (
    !Number.isInteger(maxOutputTokens) ||
    maxOutputTokens < 128 ||
    maxOutputTokens > 8192
  )
    throw providerUnavailable();
  return {
    schema: z.toJSONSchema(request.schema),
    maxOutputTokens,
  };
}
export function parseGenerated<T>(
  request: GenerationRequest<T>,
  text: string,
): T {
  if (Buffer.byteLength(text, "utf8") > MAX_OUTPUT_BYTES)
    throw providerUnavailable();
  try {
    return request.schema.parse(JSON.parse(text));
  } catch {
    throw providerUnavailable();
  }
}
/** Reject overload immediately: do not retain learner prompts in an unbounded queue. */
export class InferenceGate {
  private active = 0;
  constructor(private readonly maximum: number) {
    if (!Number.isInteger(maximum) || maximum < 1 || maximum > 16)
      throw new Error("Inference concurrency must be between 1 and 16.");
  }
  async run<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
    if (signal.aborted) throw providerUnavailable();
    if (this.active >= this.maximum)
      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        "Melissa is helping a few learners right now. Please try again shortly.",
        503,
      );
    this.active += 1;
    try {
      return await operation();
    } finally {
      this.active -= 1;
    }
  }
}
