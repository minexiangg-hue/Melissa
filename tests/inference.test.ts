import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { freshState } from "@/domain/models";
import { SqliteLearnerRepository } from "@/server/storage/sqlite";
import { InferenceCoordinator } from "@/server/inference/coordinator";
import { Orchestrator } from "@/server/orchestrator";
import { AiTeacher } from "@/server/providers/ai-teacher";
import { DemoGuard } from "@/server/providers/demo";
import type { StructuredGenerator } from "@/server/providers/structured";
import { MaterialService } from "@/server/learning/service";
import { AiMaterialProvider } from "@/server/learning/providers";
import { buildMaterialContext } from "@/server/learning/knowledge";
import { migrations } from "@/server/storage/migrations";
import { profile } from "./helpers";

const cleanups: (() => void)[] = [];
afterEach(() =>
  cleanups
    .splice(0)
    .reverse()
    .forEach((cleanup) => cleanup()),
);
function setup(
  options: {
    daily?: number;
    global?: number;
    path?: string;
    generator?: StructuredGenerator;
  } = {},
) {
  let now = Date.now();
  const repository = new SqliteLearnerRepository(
    options.path ?? ":memory:",
    () => now,
  );
  cleanups.push(() => repository.close());
  const owner = randomUUID();
  repository.create(
    owner,
    freshState(new Date(now).toISOString().slice(0, 10)),
    now + 30 * 86400000,
  );
  const calls: string[] = [];
  const generator: StructuredGenerator = options.generator ?? {
    kind: "codex",
    async generate(request) {
      calls.push(request.name);
      const content =
        request.name === "melissa_learning_material"
          ? buildMaterialContext("B1", "everyday", "coffee").seed.draft
          : {
              text: "You can say: ‘Yesterday, I went to the library.’ What did you read?",
            };
      return {
        data: request.schema.parse(content),
        usage: { inputTokens: 50, outputTokens: 20 },
        requestId: "provider-private-id",
      };
    },
  };
  const inference = new InferenceCoordinator(repository.inference, {
    daily: options.daily ?? 10,
    global: options.global ?? 100,
    leaseMs: 1000,
  });
  const metered = inference.metered(generator);
  const service = new Orchestrator(
    repository,
    new DemoGuard(),
    new AiTeacher(metered),
    {
      dailyUnitLimit: 15000,
      timeoutMs: 500,
      teacherKind: "codex",
      inference,
      materials: new MaterialService(new AiMaterialProvider(metered)),
      now: () => new Date(now),
    },
  );
  const initial = service.updateProfile(owner, 0, profile);
  return {
    repository,
    owner,
    service,
    inference,
    calls,
    initial,
    advance: (ms: number) => {
      now += ms;
    },
  };
}
function disk() {
  const directory = mkdtempSync(join(tmpdir(), "melissa-ledger-"));
  cleanups.push(() => rmSync(directory, { recursive: true, force: true }));
  return join(directory, "learner.db");
}

describe("durable AI integration", () => {
  it("persists real teacher output and reported usage once; replays a lost response", async () => {
    const f = setup();
    const s = f.service.startSession(
      f.owner,
      f.initial.state.revision,
      "everyday-b1",
    );
    const id = s.state.sessions[0]!.id;
    const input = {
      revision: s.state.revision,
      requestId: randomUUID(),
      text: "Yesterday I go to a library.",
    };
    const result = await f.service.sendMessage(f.owner, id, input);
    expect(result.state.sessions[0]!.messages.at(-1)!.text).toContain("went");
    expect(result.aiUsage).toMatchObject({
      requests: 1,
      inputTokens: 50,
      outputTokens: 20,
      unknownUsageRequests: 0,
    });
    expect(await f.service.sendMessage(f.owner, id, input)).toEqual(result);
    expect(f.calls).toHaveLength(1);
    expect(result.state.usage.units).toBe(0);
  });
  it("generates, owns, replays and practices a saved custom lesson", async () => {
    const f = setup();
    const input = {
      revision: f.initial.state.revision,
      requestId: randomUUID(),
      topic: "coffee",
      goal: "everyday" as const,
    };
    const result = await f.service.generateMaterial(f.owner, input);
    expect(result.state.materials[0]).toMatchObject({
      provider: "codex",
      requestedTopic: "coffee",
    });
    expect(await f.service.generateMaterial(f.owner, input)).toEqual(result);
    await expect(
      f.service.generateMaterial(f.owner, { ...input, topic: "airport" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const practice = f.service.startSession(
      f.owner,
      result.state.revision,
      result.state.materials[0]!.id,
    );
    expect(practice.state.sessions[0]!.lesson.title).toBe(
      result.state.materials[0]!.title,
    );
    expect(f.calls).toHaveLength(1);
    const stranger = randomUUID();
    f.repository.create(
      stranger,
      freshState("2026-10-15"),
      Date.now() + 86400000,
    );
    const strangerState = f.service.updateProfile(stranger, 0, profile);
    expect(() =>
      f.service.startSession(
        stranger,
        strangerState.state.revision,
        result.state.materials[0]!.id,
      ),
    ).toThrow("not available");
  });
  it("locks a learner before inference and prevents competing paid calls or profile writes", async () => {
    let finish!: () => void;
    let entered!: () => void;
    const began = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let calls = 0;
    const generate: StructuredGenerator["generate"] = async (request) => {
      calls += 1;
      entered();
      await new Promise<void>((resolve) => {
        finish = resolve;
      });
      return {
        data: request.schema.parse({ text: "Tell me about your day." }),
        usage: null,
      };
    };
    const f = setup({ generator: { kind: "codex", generate } });
    const s = f.service.startSession(
      f.owner,
      f.initial.state.revision,
      "everyday-b1",
    );
    const input = {
      revision: s.state.revision,
      requestId: randomUUID(),
      text: "Hello, I am Mei.",
    };
    const first = f.service.sendMessage(
      f.owner,
      s.state.sessions[0]!.id,
      input,
    );
    await began;
    await expect(
      f.service.sendMessage(f.owner, s.state.sessions[0]!.id, {
        ...input,
        requestId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(() =>
      f.service.updateProfile(f.owner, s.state.revision, {
        ...profile,
        level: "A2",
      }),
    ).toThrow("still preparing");
    finish();
    await first;
    expect(calls).toBe(1);
  });
  it("rolls back both a learner save and completion on transaction failure", async () => {
    const f = setup();
    const before = f.repository.read(f.owner)!;
    await expect(
      f.inference.run(
        {
          owner: f.owner,
          requestId: randomUUID(),
          fingerprint: "atomic",
          revision: before.revision,
        },
        async () => "answer",
        () => {
          f.repository.save(f.owner, before.revision, {
            ...before,
            revision: before.revision + 1,
          });
          throw new Error("simulate failure after learner update");
        },
      ),
    ).rejects.toMatchObject({ code: "RETRY_REQUIRED" });
    expect(f.repository.read(f.owner)).toEqual(before);
    expect(f.inference.usage(f.owner).requests).toBe(1);
    f.inference.assertAvailable(f.owner);
  });
  it("retains uncertain attempts in quotas without silently repeating a paid request", async () => {
    let calls = 0;
    const generate: StructuredGenerator["generate"] = async () => {
      calls += 1;
      throw new Error("upstream disconnected");
    };
    const f = setup({ daily: 1, generator: { kind: "codex", generate } });
    const s = f.service.startSession(
      f.owner,
      f.initial.state.revision,
      "everyday-b1",
    );
    const input = {
      revision: s.state.revision,
      requestId: randomUUID(),
      text: "Tell me a little more.",
    };
    for (let i = 0; i < 2; i++)
      await expect(
        f.service.sendMessage(f.owner, s.state.sessions[0]!.id, input),
      ).rejects.toMatchObject({ code: "RETRY_REQUIRED" });
    await expect(
      f.service.sendMessage(f.owner, s.state.sessions[0]!.id, {
        ...input,
        requestId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    expect(calls).toBe(1);
    expect(f.service.snapshot(f.owner).state).toEqual(s.state);
    expect(f.inference.usage(f.owner).unknownUsageRequests).toBe(1);
  });
  it("deletion erases private metadata but cannot reset the deployment's daily cap", async () => {
    const path = disk();
    const f = setup({ path, global: 1 });
    const result = await f.service.generateMaterial(f.owner, {
      revision: f.initial.state.revision,
      requestId: randomUUID(),
      topic: "coffee",
      goal: "everyday",
    });
    f.service.deleteData(f.owner, result.state.revision);
    const db = new DatabaseSync(path);
    cleanups.push(() => db.close());
    expect(
      db
        .prepare(
          "SELECT owner_hash,request_id,fingerprint,provider_request_id,input_tokens FROM inference_requests",
        )
        .get(),
    ).toEqual({
      owner_hash: null,
      request_id: "",
      fingerprint: "",
      provider_request_id: null,
      input_tokens: 0,
    });
    const other = setup({ path, global: 1 });
    await expect(
      other.service.generateMaterial(other.owner, {
        revision: other.initial.state.revision,
        requestId: randomUUID(),
        topic: "coffee",
        goal: "everyday",
      }),
    ).rejects.toMatchObject({ code: "LIMIT_REACHED" });
  });
  it("loads released v1 records and migrates without losing sessions or identity expiry", () => {
    const path = disk();
    const db = new DatabaseSync(path);
    db.exec(migrations[0]!.sql);
    db.exec("PRAGMA user_version=1");
    const expiry = Date.now() + 86400000;
    const legacy = {
      schemaVersion: 1,
      revision: 4,
      profile,
      sessions: [],
      usage: { day: "2026-09-15", units: 123 },
    };
    db.prepare("INSERT INTO learners VALUES(?,?,?,?)").run(
      "legacy-owner",
      4,
      JSON.stringify(legacy),
      expiry,
    );
    db.close();
    const repository = new SqliteLearnerRepository(path);
    cleanups.push(() => repository.close());
    expect(repository.read("legacy-owner")).toEqual({
      ...legacy,
      materials: [],
    });
    expect(repository.expiresAt("legacy-owner")).toBe(expiry);
  });
});
