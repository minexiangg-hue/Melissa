import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { OpenAICompatibleGenerator } from "@/server/providers/openai-compatible";
import { CodexGenerator, codexArguments } from "@/server/providers/codex";
import {
  InferenceGate,
  type GenerationRequest,
} from "@/server/providers/structured";
import { AiTeacher } from "@/server/providers/ai-teacher";
import { buildTeachingContext } from "@/domain/prompt";
import { lessonsFor } from "@/domain/curriculum";
import type { Profile, Session } from "@/domain/models";

const cleanup: Array<() => Promise<unknown>> = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((fn) => fn()));
  vi.unstubAllEnvs();
});
const request: GenerationRequest<{ text: string }> = {
  name: "teacher",
  system: "You are Melissa. Return JSON.",
  input: "Yesterday I go to library.",
  schema: z.object({ text: z.string().min(1).max(1600) }).strict(),
  maxOutputTokens: 1024,
};
const completion = (
  content = JSON.stringify({ text: "Yesterday, I went to the library." }),
) => ({
  id: "completion-test",
  choices: [{ finish_reason: "stop", message: { content } }],
  usage: { prompt_tokens: 32, completion_tokens: 16 },
});
async function api(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
) {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanup.push(
    () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing fixture address");
  return new OpenAICompatibleGenerator({
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    apiKey: "private-test-key",
    model: "test-model",
    timeoutMs: 500,
    maxConcurrentRequests: 1,
    responseFormat: "json_schema",
    tokenParameter: "max_completion_tokens",
  });
}
async function fakeCodex(body: string, timeoutMs = 2000) {
  const directory = await mkdtemp(join(tmpdir(), "melissa-provider-test-"));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  const authPath = join(directory, "auth.json");
  const binary = join(directory, "codex-fixture.mjs");
  await writeFile(authPath, '{"test":"private-auth-fixture"}', { mode: 0o600 });
  await writeFile(binary, `#!${process.execPath}\n${body}`, { mode: 0o700 });
  await chmod(binary, 0o700);
  return {
    directory,
    authPath,
    generator: new CodexGenerator({
      binary,
      authPath,
      model: "fixture-model",
      timeoutMs,
      maxConcurrentRequests: 1,
    }),
  };
}
const emitSuccess = `
const emit = (event) => process.stdout.write(JSON.stringify(event) + '\\n');
emit({type:'thread.started',thread_id:'codex-test'});
emit({type:'item.completed',item:{type:'agent_message',text:JSON.stringify({text:'Yesterday, I went to the library.'})}});
emit({type:'turn.completed',usage:{input_tokens:31,output_tokens:15}});
`;

describe("external API adapter", () => {
  it("calls the real HTTP contract with isolated system/user content and measured usage", async () => {
    let incoming: Record<string, unknown> | undefined;
    let auth: string | undefined;
    const generator = await api((req, res) => {
      auth = req.headers.authorization;
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        incoming = JSON.parse(body);
        res.end(JSON.stringify(completion()));
      });
    });
    const result = await generator.generate(
      request,
      new AbortController().signal,
    );
    expect(result).toEqual({
      data: { text: "Yesterday, I went to the library." },
      usage: { inputTokens: 32, outputTokens: 16 },
      requestId: "completion-test",
    });
    expect(auth).toBe("Bearer private-test-key");
    expect(incoming).toMatchObject({
      model: "test-model",
      max_completion_tokens: 1024,
      response_format: { type: "json_schema", json_schema: { strict: true } },
    });
    expect(
      (incoming?.messages as { role: string; content: string }[])[1],
    ).toEqual({ role: "user", content: request.input });
    expect(JSON.stringify(incoming)).not.toContain("private-test-key");
  });
  it.each([
    "invalid JSON",
    JSON.stringify({ text: "valid", unexpected: true }),
    JSON.stringify({ text: "x".repeat(1601) }),
  ])("rejects malformed/untrusted model output", async (content) => {
    const generator = await api((_req, res) =>
      res.end(JSON.stringify(completion(content))),
    );
    await expect(
      generator.generate(request, new AbortController().signal),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });
  it.each(["refusal", "truncated", "http", "oversized"])(
    "fails closed on %s without leaking provider errors",
    async (mode) => {
      const generator = await api((_req, res) => {
        if (mode === "http") {
          res.statusCode = 401;
          return res.end("private-test-key user-data");
        }
        if (mode === "oversized") return res.end("x".repeat(65537));
        const result = completion();
        if (mode === "truncated") result.choices[0]!.finish_reason = "length";
        if (mode === "refusal")
          Object.assign(result.choices[0]!.message, {
            refusal: "private-test-key",
          });
        res.end(JSON.stringify(result));
      });
      await expect(
        generator.generate(request, new AbortController().signal),
      ).rejects.toThrow("Melissa could not finish");
    },
  );
  it("aborts hanging calls and releases concurrency for retry", async () => {
    const generator = await api(() => undefined);
    const controller = new AbortController();
    const active = generator.generate(request, controller.signal);
    const failed = expect(active).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
    await expect(
      generator.generate(request, new AbortController().signal),
    ).rejects.toThrow("helping a few learners");
    controller.abort();
    await failed;
    await expect(
      generator.generate(request, new AbortController().signal),
    ).rejects.toThrow("could not finish");
  });
});

describe("isolated Codex adapter", () => {
  it("uses a private temporary home, never inherits credentials, and cleans up", async () => {
    vi.stubEnv("MELISSA_PRIVATE_TEST_SECRET", "not-for-the-child");
    const fixture = await fakeCodex(`
import { statSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
let input = ''; for await (const chunk of process.stdin) input += chunk;
if (process.env.MELISSA_PRIVATE_TEST_SECRET || process.env.HOME !== process.env.CODEX_HOME) process.exit(8);
if ((statSync(join(process.env.CODEX_HOME,'auth.json')).mode & 0o777) !== 0o600) process.exit(9);
if (!readFileSync(join(process.env.CODEX_HOME,'auth.json'),'utf8').includes('private-auth-fixture')) process.exit(10);
writeFileSync(join(dirname(process.argv[1]), 'run-path'), process.env.CODEX_HOME);
${emitSuccess}
`);
    const result = await fixture.generator.generate(
      request,
      new AbortController().signal,
    );
    expect(result.usage).toEqual({ inputTokens: 31, outputTokens: 15 });
    expect(result.requestId).toBe("codex-test");
    expect(await readFile(fixture.authPath, "utf8")).toBe(
      '{"test":"private-auth-fixture"}',
    );
    await expect(
      stat(await readFile(join(fixture.directory, "run-path"), "utf8")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("disables tool runtimes and rejects tool event output", async () => {
    const argumentsList = codexArguments(
      { schema: "/tmp/schema", instructions: "/tmp/instructions" },
      "fixture-model",
    );
    expect(argumentsList).toContain("--ignore-user-config");
    expect(argumentsList).toContain("--ephemeral");
    expect(argumentsList).toContain("read-only");
    for (const feature of [
      "shell_tool",
      "code_mode_host",
      "apps",
      "plugins",
      "multi_agent",
      "hooks",
      "view_image",
    ])
      expect(argumentsList).toContain(feature);
    const fixture = await fakeCodex(
      `process.stdout.write(JSON.stringify({type:'item.started',item:{type:'command_execution',command:'forbidden'}})+'\\n');setInterval(()=>{},1000);`,
    );
    await expect(
      fixture.generator.generate(request, new AbortController().signal),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });
  it("kills hung processes on deadline and supports subsequent attempts", async () => {
    const fixture = await fakeCodex("setInterval(()=>{},1000);", 50);
    await expect(
      fixture.generator.generate(request, new AbortController().signal),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    await expect(
      fixture.generator.generate(request, new AbortController().signal),
    ).rejects.toThrow("could not finish");
  });
  it("rejects stdout overflow and schema-invalid output", async () => {
    const overflow = await fakeCodex(
      "process.stdout.write('x'.repeat(1024*1024+1));setInterval(()=>{},1000);",
    );
    await expect(
      overflow.generator.generate(request, new AbortController().signal),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    const invalid = await fakeCodex(
      emitSuccess.replace("Yesterday, I went to the library.", ""),
    );
    await expect(
      invalid.generator.generate(request, new AbortController().signal),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });
});
it("releases a concurrency slot after an operation throws", async () => {
  const gate = new InferenceGate(1);
  await expect(
    gate.run(new AbortController().signal, async () => {
      throw new Error("failed");
    }),
  ).rejects.toThrow("failed");
  await expect(
    gate.run(new AbortController().signal, async () => 42),
  ).resolves.toBe(42);
});
it("teacher sends contextual learning data and returns only the domain response", async () => {
  const generate = vi.fn().mockResolvedValue({
    data: { text: "Try ‘I went’ for yesterday. What did you read?" },
    usage: { inputTokens: 100, outputTokens: 30 },
  });
  const teacher = new AiTeacher({ kind: "codex", generate });
  const profile: Profile = {
    displayName: "Learner",
    level: "B1",
    goal: "everyday",
    nativeLanguage: "Chinese",
    dailyMinutes: 10,
  };
  const lesson = lessonsFor("B1")[0]!;
  const session = {
    level: "B1",
    lesson,
    memory: { archivedMessages: 0, practicedObjectiveIds: [], redirects: 0 },
    practicedObjectiveIds: [],
    messages: [],
  } as unknown as Session;
  const context = buildTeachingContext(
    profile,
    session,
    "Yesterday I go to library.",
    "practice",
  );
  const result = await teacher.respond(context, new AbortController().signal);
  expect(result).toEqual({
    text: "Try ‘I went’ for yesterday. What did you read?",
  });
  expect(JSON.parse(generate.mock.calls[0]![0].input)).toMatchObject({
    input: context.input,
    learner: { level: "B1", nativeLanguage: "Chinese" },
  });
});
