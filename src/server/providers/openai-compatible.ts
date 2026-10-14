import "server-only";
import { z } from "zod";
import {
  InferenceGate,
  MAX_OUTPUT_BYTES,
  parseGenerated,
  prepareRequest,
  providerUnavailable,
  type GenerationRequest,
  type GenerationResult,
  type StructuredGenerator,
} from "./structured";

export interface OpenAICompatibleOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxConcurrentRequests: number;
  responseFormat: "json_schema" | "json_object";
  tokenParameter: "max_completion_tokens" | "max_tokens";
}
const completionSchema = z.object({
  id: z.string().max(200).optional(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable(),
        message: z.object({
          content: z.string().nullable(),
          refusal: z.string().nullable().optional(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative(),
      completion_tokens: z.number().int().nonnegative(),
    })
    .optional(),
});
async function readBoundedBody(response: Response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (declaredLength > MAX_OUTPUT_BYTES || !response.body)
    throw providerUnavailable();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_OUTPUT_BYTES) throw providerUnavailable();
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
/** OpenAI-compatible Chat Completions. Credentials never enter prompts or browser state. */
export class OpenAICompatibleGenerator implements StructuredGenerator {
  readonly kind = "openai-compatible" as const;
  private readonly gate: InferenceGate;
  constructor(
    private readonly options: OpenAICompatibleOptions,
    private readonly transport: typeof fetch = fetch,
  ) {
    this.gate = new InferenceGate(options.maxConcurrentRequests);
  }
  generate<T>(
    request: GenerationRequest<T>,
    signal: AbortSignal,
  ): Promise<GenerationResult<T>> {
    return this.gate.run(signal, async () => {
      const { schema, maxOutputTokens } = prepareRequest(request);
      const deadline = AbortSignal.timeout(this.options.timeoutMs);
      const combined = AbortSignal.any([signal, deadline]);
      try {
        const response = await this.transport(
          `${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`,
          {
            method: "POST",
            redirect: "error",
            cache: "no-store",
            signal: combined,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.options.apiKey}`,
            },
            body: JSON.stringify({
              model: this.options.model,
              messages: [
                {
                  role: "system",
                  content: `${request.system}\nReturn one JSON object matching this schema: ${JSON.stringify(schema)}`,
                },
                { role: "user", content: request.input },
              ],
              [this.options.tokenParameter]: maxOutputTokens,
              response_format:
                this.options.responseFormat === "json_schema"
                  ? {
                      type: "json_schema",
                      json_schema: { name: request.name, strict: true, schema },
                    }
                  : { type: "json_object" },
            }),
          },
        );
        if (!response.ok) {
          await response.body?.cancel();
          throw providerUnavailable();
        }
        const result = completionSchema.parse(
          JSON.parse(await readBoundedBody(response)),
        );
        const choice = result.choices[0]!;
        if (
          choice.finish_reason !== "stop" ||
          choice.message.refusal ||
          !choice.message.content
        )
          throw providerUnavailable();
        return {
          data: parseGenerated(request, choice.message.content),
          usage: result.usage
            ? {
                inputTokens: result.usage.prompt_tokens,
                outputTokens: result.usage.completion_tokens,
              }
            : null,
          ...(result.id ? { requestId: result.id } : {}),
        };
      } catch {
        // Provider bodies can contain credentials, learner text, or deployment details.
        throw providerUnavailable();
      }
    });
  }
}
