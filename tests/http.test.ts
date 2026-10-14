import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { SqliteLearnerRepository } from "@/server/storage/sqlite";
import { MaterialService } from "@/server/learning/service";
import { DemoMaterialProvider } from "@/server/learning/providers";
import { Orchestrator } from "@/server/orchestrator";
import { DemoGuard, DemoTeacher } from "@/server/providers/demo";
import { profile } from "./helpers";
import { freshState } from "@/domain/models";
import { LEGACY_GUEST_COOKIE } from "@/server/http/identity";
const context = vi.hoisted(() => ({ container: null as unknown }));
vi.mock("@/server/container", () => ({
  getContainer: () => context.container,
}));
import { handleRequest } from "@/server/http/handler";
let repository: SqliteLearnerRepository;
beforeAll(() => {
  repository = new SqliteLearnerRepository(":memory:");
  context.container = {
    repository,
    config: { APP_ORIGIN: "http://127.0.0.1:3000", COOKIE_SECURE: "false" },
    orchestrator: new Orchestrator(
      repository,
      new DemoGuard(),
      new DemoTeacher(),
      {
        dailyUnitLimit: 15000,
        timeoutMs: 100,
        materials: new MaterialService(new DemoMaterialProvider()),
      },
    ),
  };
});
afterAll(() => repository.close());
function req(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  origin = "http://127.0.0.1:3000",
) {
  return new NextRequest(`http://127.0.0.1:3000/api/v1/${path}`, {
    method,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
async function bootstrap() {
  const response = await handleRequest(req("bootstrap", "POST", {}));
  return {
    cookie: response.headers.get("set-cookie")!.split(";")[0]!,
    data: await response.json(),
    response,
  };
}
describe("HTTP security and contracts", () => {
  it("creates opaque HttpOnly guest credentials, not owner IDs", async () => {
    const { response, data } = await bootstrap();
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(
      /melissa_guest=[a-f0-9]{64}/,
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(JSON.stringify(data)).not.toMatch(
      /ownerHash|owner_hash|melissa_guest/,
    );
  });
  it("rejects cross-origin writes and anonymous reads", async () => {
    expect(
      (
        await handleRequest(
          req("bootstrap", "POST", {}, undefined, "https://evil.example"),
        )
      ).status,
    ).toBe(403);
    expect((await handleRequest(req("state"))).status).toBe(401);
    expect(
      (
        await handleRequest(
          req("state", "GET", undefined, "melissa_guest=forged"),
        )
      ).status,
    ).toBe(401);
  });
  it("rejects malformed JSON, extra fields, wrong types, oversized bodies and media types", async () => {
    const { cookie } = await bootstrap();
    const malformed = req("profile", "PUT", undefined, cookie);
    const broken = new NextRequest(malformed.url, {
      method: "PUT",
      headers: malformed.headers,
      body: "{",
    });
    expect((await handleRequest(broken)).status).toBe(400);
    expect(
      (
        await handleRequest(
          req("profile", "PUT", { revision: 0, profile, admin: true }, cookie),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await handleRequest(
          req("profile", "PUT", { revision: "0", profile }, cookie),
        )
      ).status,
    ).toBe(422);
    expect(
      (
        await handleRequest(
          req("profile", "PUT", { huge: "a".repeat(20000) }, cookie),
        )
      ).status,
    ).toBe(413);
    const text = req("profile", "PUT", {}, cookie);
    text.headers.set("Content-Type", "text/plain");
    expect((await handleRequest(text)).status).toBe(415);
  });
  it("isolates two browsers and supports retry-safe turns and deletion", async () => {
    const a = await bootstrap();
    const b = await bootstrap();
    let response = await handleRequest(
      req("profile", "PUT", { revision: 0, profile }, a.cookie),
    );
    expect(response.status).toBe(200);
    response = await handleRequest(
      req(
        "sessions",
        "POST",
        { revision: 1, lessonId: "everyday-b1" },
        a.cookie,
      ),
    );
    const started = await response.json();
    const id = started.state.sessions[0].id;
    const payload = {
      revision: 2,
      requestId: randomUUID(),
      text: "Hello, I am Mei.",
    };
    expect(
      (
        await handleRequest(
          req(`sessions/${id}/messages`, "POST", payload, b.cookie),
        )
      ).status,
    ).toBe(404);
    const other = await (
      await handleRequest(req("state", "GET", undefined, b.cookie))
    ).json();
    expect(other.state.profile).toBeNull();
    expect(other.state.sessions).toEqual([]);
    const sent = await (
      await handleRequest(
        req(`sessions/${id}/messages`, "POST", payload, a.cookie),
      )
    ).json();
    const replayed = await (
      await handleRequest(
        req(`sessions/${id}/messages`, "POST", payload, a.cookie),
      )
    ).json();
    expect(replayed).toEqual(sent);
    response = await handleRequest(
      req("data", "DELETE", { revision: sent.state.revision }, a.cookie),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(
      (await handleRequest(req("state", "GET", undefined, a.cookie))).status,
    ).toBe(401);
  });
  it("returns explicit missing endpoints and exposes only a minimal health check", async () => {
    const { cookie } = await bootstrap();
    expect((await handleRequest(req("stt", "POST", {}, cookie))).status).toBe(
      404,
    );
    const health = await handleRequest(req("health"));
    expect(await health.json()).toEqual({ status: "ok", mode: "demo" });
  });
});

describe("Melissa guest migration", () => {
  function legacyGuest(expiresAt: number, displayName = "Existing learner") {
    const token = randomBytes(32).toString("hex");
    const owner = createHash("sha256").update(token).digest("hex");
    const state = freshState(new Date().toISOString().slice(0, 10));
    state.profile = { ...profile, displayName };
    repository.create(owner, state, expiresAt);
    return { token, owner, cookie: `${LEGACY_GUEST_COOKIE}=${token}` };
  }
  it("migrates an existing guest without changing records, ownership or expiry", async () => {
    const expiry = Date.now() + 2 * 86400000;
    const guest = legacyGuest(expiry);
    const service = new Orchestrator(
      repository,
      new DemoGuard(),
      new DemoTeacher(),
      {
        dailyUnitLimit: 15000,
        timeoutMs: 100,
        materials: new MaterialService(new DemoMaterialProvider()),
      },
    );
    const started = service.startSession(guest.owner, 0, "everyday-b1");
    const before = await service.sendMessage(
      guest.owner,
      started.state.sessions[0]!.id,
      {
        revision: started.state.revision,
        requestId: randomUUID(),
        text: "Hello, I am learning English.",
      },
    );
    const response = await handleRequest(
      req("bootstrap", "POST", {}, guest.cookie),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).state).toEqual(before.state);
    const migrated = response.cookies.get("melissa_guest")!;
    expect(migrated.value).toBe(guest.token);
    expect(migrated.maxAge).toBeLessThanOrEqual(2 * 86400);
    expect(migrated.maxAge).toBeGreaterThan(2 * 86400 - 5);
    expect(response.cookies.get(LEGACY_GUEST_COOKIE)?.maxAge).toBe(0);
    expect(repository.expiresAt(guest.owner)).toBe(expiry);
    const state = await handleRequest(
      req("state", "GET", undefined, `melissa_guest=${guest.token}`),
    );
    expect((await state.json()).state).toEqual(before.state);
  });
  it("prefers the current Melissa identity when both cookie names exist", async () => {
    const current = await bootstrap();
    const legacy = legacyGuest(Date.now() + 86400000, "Other guest");
    const response = await handleRequest(
      req("bootstrap", "POST", {}, `${current.cookie}; ${legacy.cookie}`),
    );
    expect((await response.json()).state).toEqual(current.data.state);
    expect(response.cookies.get("melissa_guest")).toBeUndefined();
    expect(response.cookies.get(LEGACY_GUEST_COOKIE)?.maxAge).toBe(0);
    expect(repository.read(legacy.owner)?.profile?.displayName).toBe(
      "Other guest",
    );
  });
  it("never restores expired legacy data and clears invalid legacy cookies", async () => {
    const expired = legacyGuest(Date.now() - 1);
    expect(
      (await handleRequest(req("state", "GET", undefined, expired.cookie)))
        .status,
    ).toBe(401);
    for (const cookie of [expired.cookie, `${LEGACY_GUEST_COOKIE}=forged`]) {
      const response = await handleRequest(
        req("bootstrap", "POST", {}, cookie),
      );
      expect((await response.json()).state.profile).toBeNull();
      expect(response.cookies.get("melissa_guest")?.value).not.toBe(
        expired.token,
      );
      expect(response.cookies.get(LEGACY_GUEST_COOKIE)?.maxAge).toBe(0);
    }
  });
  it("deletes the same underlying account and both cookie names during migration", async () => {
    const guest = legacyGuest(Date.now() + 86400000);
    const response = await handleRequest(
      req("data", "DELETE", { revision: 0 }, guest.cookie),
    );
    expect(response.status).toBe(200);
    expect(response.cookies.get("melissa_guest")?.maxAge).toBe(0);
    expect(response.cookies.get(LEGACY_GUEST_COOKIE)?.maxAge).toBe(0);
    expect(repository.read(guest.owner)).toBeNull();
    expect(
      (
        await handleRequest(
          req("state", "GET", undefined, `melissa_guest=${guest.token}`),
        )
      ).status,
    ).toBe(401);
  });
  it("uses the configured HTTPS origin behind a proxy and issues Secure cookies", async () => {
    const container = context.container as {
      config: { APP_ORIGIN: string; COOKIE_SECURE: string };
    };
    const previous = container.config;
    container.config = {
      APP_ORIGIN: "https://melissa.example:3201",
      COOKIE_SECURE: "true",
    };
    try {
      const response = await handleRequest(
        req("bootstrap", "POST", {}, undefined, "https://melissa.example:3201"),
      );
      expect(response.status).toBe(200);
      expect(response.cookies.get("melissa_guest")?.secure).toBe(true);
      expect(
        (
          await handleRequest(
            req("bootstrap", "POST", {}, undefined, "https://melissa.example"),
          )
        ).status,
      ).toBe(403);
      expect((await handleRequest(req("bootstrap", "POST", {}))).status).toBe(
        403,
      );
    } finally {
      container.config = previous;
    }
  });
});

describe("material HTTP flow", () => {
  it("requires identity and a profile, then creates a durable lesson and rejects forged replay", async () => {
    const { cookie, data } = await bootstrap();
    const request = {
      revision: data.state.revision,
      requestId: randomUUID(),
      goal: "travel",
      topic: "A museum visit",
    };
    expect(
      (await handleRequest(req("materials", "POST", request))).status,
    ).toBe(401);
    expect(
      (await handleRequest(req("materials", "POST", request, cookie))).status,
    ).toBe(422);
    const configured = await (
      await handleRequest(
        req("profile", "PUT", { revision: 0, profile }, cookie),
      )
    ).json();
    request.revision = configured.state.revision;
    const created = await handleRequest(
      req("materials", "POST", request, cookie),
    );
    expect(created.status).toBe(201);
    const saved = await created.json();
    expect(saved.state.materials[0].exercises.length).toBeGreaterThanOrEqual(3);
    expect(saved.knowledge.seedCount).toBeGreaterThanOrEqual(12);
    expect(saved.capabilities.materialGeneration).toBe(true);
    const replay = await handleRequest(
      req("materials", "POST", request, cookie),
    );
    expect((await replay.json()).state.materials).toEqual(
      saved.state.materials,
    );
    expect(
      (
        await handleRequest(
          req("materials", "POST", { ...request, topic: "changed" }, cookie),
        )
      ).status,
    ).toBe(409);
    const restored = await (
      await handleRequest(req("state", "GET", undefined, cookie))
    ).json();
    expect(restored.state.materials).toEqual(saved.state.materials);
    const session = await handleRequest(
      req(
        "sessions",
        "POST",
        {
          revision: saved.state.revision,
          lessonId: saved.state.materials[0].id,
        },
        cookie,
      ),
    );
    expect(session.status).toBe(201);
    expect(
      (await session.json()).state.sessions[0].lesson.material.reading.text,
    ).toBe(saved.state.materials[0].reading.text);
  });
});
