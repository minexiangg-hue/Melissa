import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError } from "@/domain/errors";
import {
  freshState,
  mutationSchema,
  sendMessageSchema,
  startSessionSchema,
  updateProfileSchema,
} from "@/domain/models";
import { getContainer } from "../container";

const COOKIE = "yet_guest";
const TTL_SECONDS = 60 * 60 * 24 * 30;
const MAX_BODY_BYTES = 16 * 1024;
function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function readJson<T>(
  request: NextRequest,
  schema: ZodType<T>,
): Promise<T> {
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim() !==
    "application/json"
  )
    throw new AppError(
      "VALIDATION",
      "Use application/json for this request.",
      415,
    );
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_BODY_BYTES)
    throw new AppError("VALIDATION", "Request body is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader)
    throw new AppError("VALIDATION", "A JSON request body is required.", 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new AppError("VALIDATION", "Request body is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AppError("VALIDATION", "Request body must be valid JSON.", 400);
  }
  return schema.parse(parsed);
}

export async function handleRequest(request: NextRequest) {
  const requestId = randomUUID();
  const json = (data: unknown, status = 200) =>
    NextResponse.json(data, {
      status,
      headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
    });
  try {
    const { config, repository, orchestrator } = getContainer();
    if (request.method !== "GET") {
      if (
        request.headers.get("origin") !== config.APP_ORIGIN ||
        request.headers.get("sec-fetch-site") === "cross-site"
      )
        throw new AppError("FORBIDDEN", "Request origin is not allowed.", 403);
    }
    const path = request.nextUrl.pathname.replace(/^\/api\/v1\/?/, "");
    if (path === "health" && request.method === "GET")
      return json({ status: "ok", mode: "demo" });
    const token = request.cookies.get(COOKIE)?.value;
    let owner = token && /^[a-f0-9]{64}$/.test(token) ? hash(token) : null;
    if (owner && !repository.read(owner)) owner = null;
    if (path === "bootstrap" && request.method === "POST") {
      await readJson(request, mutationSchema.pick({}));
      let newToken: string | null = null;
      if (!owner) {
        newToken = randomBytes(32).toString("hex");
        owner = hash(newToken);
        repository.create(
          owner,
          freshState(new Date().toISOString().slice(0, 10)),
          Date.now() + TTL_SECONDS * 1000,
        );
      }
      const response = json(orchestrator.snapshot(owner));
      if (newToken)
        response.cookies.set(COOKIE, newToken, {
          httpOnly: true,
          secure: config.COOKIE_SECURE === "true",
          sameSite: "strict",
          path: "/",
          maxAge: TTL_SECONDS,
        });
      return response;
    }
    if (!owner)
      throw new AppError(
        "UNAUTHENTICATED",
        "Your guest session expired. Refresh to start again.",
        401,
      );
    if (path === "state" && request.method === "GET")
      return json(orchestrator.snapshot(owner));
    if (path === "profile" && request.method === "PUT") {
      const input = await readJson(request, updateProfileSchema);
      return json(
        orchestrator.updateProfile(owner, input.revision, input.profile),
      );
    }
    if (path === "sessions" && request.method === "POST") {
      const input = await readJson(request, startSessionSchema);
      return json(
        orchestrator.startSession(owner, input.revision, input.lessonId),
        201,
      );
    }
    const route = /^sessions\/([a-f0-9-]{36})\/(messages|finish)$/.exec(path);
    if (route && request.method === "POST") {
      if (route[2] === "messages")
        return json(
          await orchestrator.sendMessage(
            owner,
            route[1]!,
            await readJson(request, sendMessageSchema),
          ),
        );
      const input = await readJson(request, mutationSchema);
      return json(orchestrator.finishSession(owner, route[1]!, input.revision));
    }
    if (path === "data" && request.method === "DELETE") {
      const input = await readJson(request, mutationSchema);
      orchestrator.deleteData(owner, input.revision);
      const response = json({ deleted: true });
      response.cookies.set(COOKIE, "", {
        httpOnly: true,
        secure: config.COOKIE_SECURE === "true",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
      });
      return response;
    }
    throw new AppError("NOT_FOUND", "Endpoint not found.", 404);
  } catch (error) {
    if (error instanceof ZodError)
      return json(
        {
          error: {
            code: "VALIDATION",
            message: "Please check the submitted fields.",
            fields: error.issues.map((i) => i.path.join(".")),
            requestId,
          },
        },
        422,
      );
    if (error instanceof AppError)
      return json(
        { error: { code: error.code, message: error.message, requestId } },
        error.status,
      );
    // Log no request bodies, provider prompts, cookies, or personal fields.
    console.error(
      JSON.stringify({
        event: "request_failed",
        requestId,
        errorType: error instanceof Error ? error.name : "UnknownError",
      }),
    );
    return json(
      {
        error: {
          code: "INTERNAL",
          message: "Something went wrong. Please try again.",
          requestId,
        },
      },
      500,
    );
  }
}
