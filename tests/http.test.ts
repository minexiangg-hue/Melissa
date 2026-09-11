import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { SqliteLearnerRepository } from "@/server/storage/sqlite";
import { Orchestrator } from "@/server/orchestrator";
import { DemoGuard, DemoTeacher } from "@/server/providers/demo";
import { profile } from "./helpers";
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
      { dailyUnitLimit: 15000, timeoutMs: 100 },
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
      /yet_guest=[a-f0-9]{64}/,
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=strict");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-request-id")).toBeTruthy();
    expect(JSON.stringify(data)).not.toMatch(/ownerHash|owner_hash|yet_guest/);
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
      (await handleRequest(req("state", "GET", undefined, "yet_guest=forged")))
        .status,
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
