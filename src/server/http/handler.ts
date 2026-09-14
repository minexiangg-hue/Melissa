import "server-only";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { AppError } from "@/domain/errors";
import {
  mutationSchema,
  sendMessageSchema,
  startSessionSchema,
  updateProfileSchema,
} from "@/domain/models";
import { getContainer } from "../container";

import {
  GUEST_COOKIE,
  LEGACY_GUEST_COOKIE,
  clearGuestCookie,
  createGuest,
  resolveGuest,
  setGuestCookie,
} from "./identity";

const MAX_BODY_BYTES = 16 * 1024;

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
    const identity = resolveGuest(request, repository);
    const owner = identity?.owner;
    const secure = config.COOKIE_SECURE === "true";
    if (path === "bootstrap" && request.method === "POST") {
      await readJson(request, mutationSchema.pick({}));
      const guest = identity ?? createGuest(repository);
      const response = json(orchestrator.snapshot(guest.owner));
      if (!identity || identity.legacy) setGuestCookie(response, guest, secure);
      if (request.cookies.has(LEGACY_GUEST_COOKIE))
        clearGuestCookie(response, LEGACY_GUEST_COOKIE, secure);
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
      clearGuestCookie(response, GUEST_COOKIE, secure);
      clearGuestCookie(response, LEGACY_GUEST_COOKIE, secure);
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
