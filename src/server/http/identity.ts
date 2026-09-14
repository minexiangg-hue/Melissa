import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { freshState } from "@/domain/models";
import type { LearnerRepository } from "@/domain/ports";

export const GUEST_COOKIE = "melissa_guest";
// Compatibility only: migrate existing guest credentials without losing their records.
export const LEGACY_GUEST_COOKIE = "yet_guest";
export const GUEST_TTL_SECONDS = 60 * 60 * 24 * 30;

interface GuestIdentity {
  owner: string;
  token: string;
  expiresAt: number;
  legacy: boolean;
}
function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function resolveGuest(
  request: NextRequest,
  repository: LearnerRepository,
): GuestIdentity | null {
  for (const name of [GUEST_COOKIE, LEGACY_GUEST_COOKIE]) {
    const token = request.cookies.get(name)?.value;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) continue;
    const owner = hash(token);
    const expiresAt = repository.expiresAt(owner);
    if (expiresAt === null) continue;
    return { owner, token, expiresAt, legacy: name === LEGACY_GUEST_COOKIE };
  }
  return null;
}
export function createGuest(repository: LearnerRepository): GuestIdentity {
  const token = randomBytes(32).toString("hex");
  const owner = hash(token);
  const expiresAt = Date.now() + GUEST_TTL_SECONDS * 1000;
  repository.create(
    owner,
    freshState(new Date().toISOString().slice(0, 10)),
    expiresAt,
  );
  return { owner, token, expiresAt, legacy: false };
}
export function setGuestCookie(
  response: NextResponse,
  identity: GuestIdentity,
  secure: boolean,
) {
  response.cookies.set(GUEST_COOKIE, identity.token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    // Migration preserves the persisted expiry; it does not grant another 30 days.
    expires: new Date(identity.expiresAt),
    maxAge: Math.max(0, Math.floor((identity.expiresAt - Date.now()) / 1000)),
  });
}
export function clearGuestCookie(
  response: NextResponse,
  name: typeof GUEST_COOKIE | typeof LEGACY_GUEST_COOKIE,
  secure: boolean,
) {
  response.cookies.set(name, "", {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
