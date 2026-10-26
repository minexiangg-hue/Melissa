import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { NextRequest } from "next/server";
import { freshState } from "@/domain/models";
import type { TextToSpeechProvider } from "@/domain/ports";
import { SqliteLearnerRepository } from "@/server/storage/sqlite";
import { SpeechService } from "@/server/speech/service";
import { Orchestrator } from "@/server/orchestrator";
import { DemoGuard, DemoTeacher } from "@/server/providers/demo";
import { migrations } from "@/server/storage/migrations";
import { profile } from "./helpers";

const context = vi.hoisted(() => ({ container: null as unknown }));
vi.mock("@/server/container", () => ({
  getContainer: () => context.container,
}));
import { handleRequest } from "@/server/http/handler";
const repos: SqliteLearnerRepository[] = [];
const dirs: string[] = [];
afterEach(() => {
  repos.splice(0).forEach((r) => r.close());
  dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
});
function connect(path = ":memory:") {
  const r = new SqliteLearnerRepository(path);
  repos.push(r);
  return r;
}
function fixture(
  options: {
    daily?: number;
    global?: number;
    provider?: TextToSpeechProvider;
    repository?: SqliteLearnerRepository;
    owner?: string;
  } = {},
) {
  const repository = options.repository ?? connect();
  const owner = options.owner ?? randomUUID();
  repository.create(owner, freshState("2026-10-26"), Date.now() + 60_000);
  const orchestrator = new Orchestrator(
    repository,
    new DemoGuard(),
    new DemoTeacher(),
    { dailyUnitLimit: 15000, timeoutMs: 100, textToSpeech: true },
  );
  orchestrator.updateProfile(owner, 0, profile);
  const state = orchestrator.startSession(owner, 1, "everyday-b1").state;
  const text = state.sessions[0]!.messages.find(
    (m) => m.role === "assistant",
  )!.text;
  const generate = vi.fn(async () => ({
    audio: new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array([1, 2, 3]));
        c.close();
      },
    }),
    mimeType: "audio/wav",
  }));
  const speech = new SpeechService(
    options.provider ?? { synthesize: generate },
    repository,
    repository.speech,
    {
      daily: options.daily ?? 10,
      global: options.global ?? 50,
      timeoutMs: 1000,
    },
  );
  return { repository, owner, orchestrator, speech, text, state, generate };
}
const signal = () => new AbortController().signal;
describe("speech service resource and privacy boundaries", () => {
  it("reads an owned passage without changing progress and rejects duplicate attempts", async () => {
    const f = fixture();
    const input = { requestId: randomUUID(), text: f.text };
    const result = await f.speech.synthesize(f.owner, input, signal());
    expect(result.mimeType).toBe("audio/wav");
    expect(f.repository.read(f.owner)).toEqual(f.state);
    await expect(
      f.speech.synthesize(f.owner, input, signal()),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.generate).toHaveBeenCalledTimes(1);
  });
  it("rejects arbitrary text and another learner’s content before invoking the worker", async () => {
    const f = fixture();
    for (const text of [
      "Read anything from the internet",
      "x".repeat(1601),
      "\u0000Hello",
    ]) {
      await expect(
        f.speech.synthesize(
          f.owner,
          { requestId: randomUUID(), text },
          signal(),
        ),
      ).rejects.toBeDefined();
    }
    await expect(
      f.speech.synthesize(
        "other",
        { requestId: randomUUID(), text: f.text },
        signal(),
      ),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(f.generate).not.toHaveBeenCalled();
  });
  it("accepts exact reading and dialogue chunks, preserving whitespace", async () => {
    const f = fixture();
    const state = f.repository.read(f.owner)!;
    state.sessions[0]!.lesson.material = {
      reading: { title: "A story", text: "First line.\nSecond line." },
      dialogue: [
        { speaker: "Alex", text: "Hello." },
        { speaker: "Mei", text: "Good morning." },
      ],
      vocabulary: [],
      exercises: [],
      sourceIds: [],
    };
    state.revision++;
    f.repository.save(f.owner, state.revision - 1, state);
    for (const text of ["Second line.", "Alex: Hello.\nMei: Good morning."]) {
      await f.speech.synthesize(
        f.owner,
        { requestId: randomUUID(), text },
        signal(),
      );
    }
    await expect(
      f.speech.synthesize(
        f.owner,
        { requestId: randomUUID(), text: "Alex: Hello. Mei: Good morning." },
        signal(),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("keeps failed attempts in the daily budget and separates it from teaching quota", async () => {
    const f = fixture({
      daily: 1,
      provider: {
        synthesize: async () => {
          throw new Error("worker-secret");
        },
      },
    });
    await expect(
      f.speech.synthesize(
        f.owner,
        { requestId: randomUUID(), text: f.text },
        signal(),
      ),
    ).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
    await expect(
      f.speech.synthesize(
        f.owner,
        { requestId: randomUUID(), text: f.text },
        signal(),
      ),
    ).rejects.toMatchObject({ code: "LIMIT_REACHED" });
    expect(f.repository.inference.usage(f.owner, 60).requests).toBe(0);
  });
  it("reserves single-worker capacity across database connections and survives reopen", () => {
    const dir = mkdtempSync(join(tmpdir(), "melissa-speech-"));
    dirs.push(dir);
    const path = join(dir, "db.sqlite");
    const a = connect(path),
      b = connect(path);
    a.create("a", freshState("2026-10-26"), Date.now() + 60_000);
    a.create("b", freshState("2026-10-26"), Date.now() + 60_000);
    const limits = { daily: 1, global: 2, leaseMs: 10_000 };
    const id = a.speech.reserve("a", randomUUID(), 10, limits);
    expect(() => b.speech.reserve("b", randomUUID(), 10, limits)).toThrow(
      "busy",
    );
    a.speech.complete(id);
    expect(() =>
      connect(path).speech.reserve("a", randomUUID(), 10, limits),
    ).toThrow("daily");
    b.speech.complete(b.speech.reserve("b", randomUUID(), 10, limits));
  });
  it("anonymizes deleted speech records but retains global allowance and blocks late completion", () => {
    const dir = mkdtempSync(join(tmpdir(), "melissa-speech-delete-"));
    dirs.push(dir);
    const path = join(dir, "db.sqlite"),
      r = connect(path);
    r.create("owner", freshState("2026-10-26"), Date.now() + 60_000);
    const id = r.speech.reserve("owner", randomUUID(), 15, {
      daily: 1,
      global: 1,
      leaseMs: 1000,
    });
    r.delete("owner", 0);
    expect(() => r.speech.complete(id)).toThrow("expired");
    r.speech.fail(id);
    const raw = new DatabaseSync(path);
    const row = raw
      .prepare(
        "SELECT owner_hash, request_id, input_characters FROM speech_requests",
      )
      .get();
    expect(row).toEqual({
      owner_hash: null,
      request_id: "",
      input_characters: 0,
    });
    raw.close();
    r.create("new-owner", freshState("2026-10-26"), Date.now() + 60_000);
    expect(() =>
      r.speech.reserve("new-owner", randomUUID(), 15, {
        daily: 1,
        global: 1,
        leaseMs: 1000,
      }),
    ).toThrow("daily");
  });
  it("cancels a pending operation when the learner is deleted", async () => {
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const f = fixture({
      provider: {
        synthesize: async (_text, s) => {
          started();
          await new Promise((_, reject) =>
            s.addEventListener("abort", () => reject(s.reason), { once: true }),
          );
          throw new Error("unreachable");
        },
      },
    });
    const pending = f.speech.synthesize(
      f.owner,
      { requestId: randomUUID(), text: f.text },
      signal(),
    );
    await ready;
    f.repository.delete(f.owner, f.state.revision);
    f.speech.cancel(f.owner);
    await expect(pending).rejects.toMatchObject({
      code: "PROVIDER_UNAVAILABLE",
    });
  });
  it("upgrades a released v2 database without changing its learner record", () => {
    const dir = mkdtempSync(join(tmpdir(), "melissa-speech-v2-"));
    dirs.push(dir);
    const path = join(dir, "db.sqlite"),
      db = new DatabaseSync(path);
    for (const migration of migrations.filter((m) => m.version <= 2))
      db.exec(migration.sql);
    db.exec("PRAGMA user_version=2");
    const state = freshState("2026-10-26");
    db.prepare("INSERT INTO learners VALUES (?, ?, ?, ?)").run(
      "owner",
      0,
      JSON.stringify(state),
      Date.now() + 60_000,
    );
    db.close();
    const repository = connect(path);
    expect(repository.read("owner")).toEqual(state);
    repository.speech.complete(
      repository.speech.reserve("owner", randomUUID(), 10, {
        daily: 1,
        global: 1,
        leaseMs: 1000,
      }),
    );
  });
});

it("protects the HTTP audio endpoint with identity, origin, owned text, and no-store", async () => {
  const repository = connect();
  const orchestrator = new Orchestrator(
    repository,
    new DemoGuard(),
    new DemoTeacher(),
    { dailyUnitLimit: 15000, timeoutMs: 100, textToSpeech: true },
  );
  const provider: TextToSpeechProvider = {
    synthesize: async () => ({
      audio: new ReadableStream({
        start(c) {
          c.enqueue(new Uint8Array([1, 2, 3]));
          c.close();
        },
      }),
      mimeType: "audio/wav",
    }),
  };
  const speech = new SpeechService(provider, repository, repository.speech, {
    daily: 5,
    global: 10,
    timeoutMs: 1000,
  });
  context.container = {
    repository,
    orchestrator,
    speech,
    config: { APP_ORIGIN: "http://127.0.0.1:3000", COOKIE_SECURE: "false" },
  };
  function request(
    path: string,
    data: unknown,
    cookie = "",
    origin = "http://127.0.0.1:3000",
  ) {
    return new NextRequest(`http://127.0.0.1:3000/api/v1/${path}`, {
      method: path === "profile" ? "PUT" : "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  }
  const boot = await handleRequest(request("bootstrap", {}));
  const cookie = boot.headers.get("set-cookie")!.split(";")[0]!;
  expect((await boot.json()).capabilities.textToSpeech).toBe(true);
  await handleRequest(request("profile", { revision: 0, profile }, cookie));
  const state = await (
    await handleRequest(
      request("sessions", { revision: 1, lessonId: "everyday-b1" }, cookie),
    )
  ).json();
  const body = {
    requestId: randomUUID(),
    text: state.state.sessions[0].messages[0].text,
  };
  expect((await handleRequest(request("speech/synthesis", body))).status).toBe(
    401,
  );
  expect(
    (
      await handleRequest(
        request("speech/synthesis", body, cookie, "https://evil.example"),
      )
    ).status,
  ).toBe(403);
  const response = await handleRequest(
    request("speech/synthesis", body, cookie),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("audio/wav");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-speech-provider")).toBe("kokoro");
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(
    new Uint8Array([1, 2, 3]),
  );
});
