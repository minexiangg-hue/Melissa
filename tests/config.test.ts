import { expect, it } from "vitest";
import { readConfig } from "@/server/config";
it("works without credentials and fails closed on unimplemented providers", () => {
  expect(readConfig({}).TEACHER_PROVIDER).toBe("demo");
  expect(() => readConfig({ TEACHER_PROVIDER: "live" })).toThrow(
    "TEACHER_PROVIDER",
  );
  expect(() => readConfig({ DAILY_DEMO_UNIT_LIMIT: "NaN" })).toThrow(
    "DAILY_DEMO_UNIT_LIMIT",
  );
});
it("requires exact origins and secure cookies for HTTPS", () => {
  expect(() => readConfig({ APP_ORIGIN: "https://melissa.example" })).toThrow(
    "COOKIE_SECURE",
  );
  expect(() => readConfig({ APP_ORIGIN: "http://melissa.example" })).toThrow(
    "HTTPS",
  );
  expect(() =>
    readConfig({ APP_ORIGIN: "http://127.0.0.1:3000/path" }),
  ).toThrow("origin");
  expect(
    readConfig({ APP_ORIGIN: "https://melissa.example", COOKIE_SECURE: "true" })
      .COOKIE_SECURE,
  ).toBe("true");
});

it("requires explicit live API credentials and validates endpoints without leaking secrets", () => {
  expect(() => readConfig({ TEACHER_PROVIDER: "openai-compatible" })).toThrow(
    "LLM_API_KEY and LLM_MODEL",
  );
  const config = readConfig({
    TEACHER_PROVIDER: "openai-compatible",
    LLM_API_KEY: "test-key",
    LLM_MODEL: "test-model",
  });
  expect(config.TEACHER_PROVIDER).toBe("openai-compatible");
  for (const url of [
    "http://remote.example/v1",
    "https://user:secret@provider.example/v1",
    "https://provider.example/v1?key=secret",
    "file:///tmp/api",
  ]) {
    expect(() => readConfig({ LLM_BASE_URL: url })).toThrow("LLM_BASE_URL");
  }
  expect(
    readConfig({ LLM_BASE_URL: "http://127.0.0.1:9000/v1" }).LLM_BASE_URL,
  ).toContain("127.0.0.1");
});
it("supports bounded Codex settings and rejects invalid resource limits", () => {
  expect(
    readConfig({ TEACHER_PROVIDER: "codex", PROVIDER_TIMEOUT_MS: "120000" })
      .CODEX_MODEL,
  ).toBe("gpt-5.6-luna");
  expect(() => readConfig({ CODEX_AUTH_PATH: "relative/auth.json" })).toThrow(
    "CODEX_AUTH_PATH",
  );
  expect(() => readConfig({ AI_MAX_CONCURRENT_REQUESTS: "0" })).toThrow(
    "AI_MAX_CONCURRENT_REQUESTS",
  );
  expect(() => readConfig({ GLOBAL_DAILY_AI_REQUEST_LIMIT: "0" })).toThrow(
    "GLOBAL_DAILY_AI_REQUEST_LIMIT",
  );
  expect(() => readConfig({ PROVIDER_TIMEOUT_MS: "180001" })).toThrow(
    "PROVIDER_TIMEOUT_MS",
  );
});

it("requires private Kokoro credentials and a safe bounded speech endpoint", () => {
  expect(readConfig({}).SPEECH_PROVIDER).toBe("device");
  expect(() => readConfig({ SPEECH_PROVIDER: "kokoro" })).toThrow(
    "SPEECH_API_TOKEN",
  );
  const config = readConfig({
    SPEECH_PROVIDER: "kokoro",
    SPEECH_API_TOKEN: "a".repeat(32),
  });
  expect(config.SPEECH_BASE_URL).toBe("http://127.0.0.1:3210");
  for (const url of [
    "http://remote.example",
    "https://user:secret@host.example",
    "http://localhost/?token=secret",
  ]) {
    expect(() => readConfig({ SPEECH_BASE_URL: url })).toThrow(
      "SPEECH_BASE_URL",
    );
  }
  expect(() => readConfig({ SPEECH_TIMEOUT_MS: "90001" })).toThrow(
    "SPEECH_TIMEOUT_MS",
  );
});
