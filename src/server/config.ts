import "server-only";
import { z } from "zod";
const configSchema = z.object({
  TEACHER_PROVIDER: z.literal("demo").default("demo"),
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
    .max(30000)
    .default(10000),
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
  return config;
}
