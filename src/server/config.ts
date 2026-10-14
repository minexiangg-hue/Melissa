import "server-only";
import { z } from "zod";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
const configSchema = z.object({
  TEACHER_PROVIDER: z
    .enum(["demo", "openai-compatible", "codex"])
    .default("demo"),
  DATABASE_PATH: z.string().min(1).default(".data/teacher.db"),
  APP_ORIGIN: z.url().default("http://127.0.0.1:3000"),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  DAILY_DEMO_UNIT_LIMIT: z.coerce
    .number()
    .int()
    .min(500)
    .max(1000000)
    .default(15000),
  PROVIDER_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(180000)
    .default(90000),
  DAILY_AI_REQUEST_LIMIT: z.coerce.number().int().min(1).max(1000).default(60),
  GLOBAL_DAILY_AI_REQUEST_LIMIT: z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .default(300),
  AI_MAX_CONCURRENT_REQUESTS: z.coerce.number().int().min(1).max(16).default(2),
  LLM_BASE_URL: z.url().default("https://api.openai.com/v1"),
  LLM_API_KEY: z.string().max(8192).optional(),
  LLM_MODEL: z.string().trim().max(200).optional(),
  LLM_RESPONSE_FORMAT: z
    .enum(["json_schema", "json_object"])
    .default("json_schema"),
  LLM_TOKEN_PARAMETER: z
    .enum(["max_completion_tokens", "max_tokens"])
    .default("max_completion_tokens"),
  CODEX_BINARY: z.string().min(1).max(4096).default("codex"),
  CODEX_MODEL: z.string().trim().min(1).max(200).default("gpt-5.6-luna"),
  CODEX_AUTH_PATH: z
    .string()
    .min(1)
    .max(4096)
    .default(join(homedir(), ".codex", "auth.json")),
});
export function readConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success)
    throw new Error(
      `Invalid server configuration: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`,
    );
  const config = parsed.data;
  const origin = new URL(config.APP_ORIGIN);
  if (
    origin.origin !== config.APP_ORIGIN ||
    !["http:", "https:"].includes(origin.protocol)
  )
    throw new Error(
      "APP_ORIGIN must be an HTTP(S) origin without a trailing slash or path.",
    );
  if (origin.protocol === "https:" && config.COOKIE_SECURE !== "true")
    throw new Error("COOKIE_SECURE must be true for HTTPS.");
  if (
    origin.protocol === "http:" &&
    !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
  )
    throw new Error("Non-local APP_ORIGIN requires HTTPS.");
  const endpoint = new URL(config.LLM_BASE_URL);
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    !["https:", "http:"].includes(endpoint.protocol) ||
    (endpoint.protocol === "http:" &&
      !["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname))
  )
    throw new Error(
      "LLM_BASE_URL requires HTTPS, or HTTP on a loopback host, without credentials, query, or fragment.",
    );
  if (
    config.TEACHER_PROVIDER === "openai-compatible" &&
    (!config.LLM_API_KEY?.trim() || !config.LLM_MODEL)
  )
    throw new Error(
      "LLM_API_KEY and LLM_MODEL are required for openai-compatible inference.",
    );
  if (
    !isAbsolute(config.CODEX_AUTH_PATH) ||
    config.CODEX_AUTH_PATH.includes("\0")
  )
    throw new Error("CODEX_AUTH_PATH must be an absolute path.");
  if (config.CODEX_BINARY.includes("\0"))
    throw new Error("CODEX_BINARY is invalid.");
  return config;
}
