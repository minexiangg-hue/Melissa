import "server-only";
import type { readConfig } from "@/server/config";
import { CodexGenerator } from "./codex";
import { OpenAICompatibleGenerator } from "./openai-compatible";
import type { StructuredGenerator } from "./structured";

export function createStructuredGenerator(
  config: ReturnType<typeof readConfig>,
): StructuredGenerator | null {
  const shared = {
    timeoutMs: config.PROVIDER_TIMEOUT_MS,
    maxConcurrentRequests: config.AI_MAX_CONCURRENT_REQUESTS,
  };
  if (config.TEACHER_PROVIDER === "codex")
    return new CodexGenerator({
      ...shared,
      binary: config.CODEX_BINARY,
      model: config.CODEX_MODEL,
      authPath: config.CODEX_AUTH_PATH,
    });
  if (config.TEACHER_PROVIDER === "openai-compatible")
    return new OpenAICompatibleGenerator({
      ...shared,
      baseUrl: config.LLM_BASE_URL,
      apiKey: config.LLM_API_KEY!,
      model: config.LLM_MODEL!,
      responseFormat: config.LLM_RESPONSE_FORMAT,
      tokenParameter: config.LLM_TOKEN_PARAMETER,
    });
  return null;
}
