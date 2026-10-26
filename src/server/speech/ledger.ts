import "server-only";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { AppError } from "@/domain/errors";

/** Audio has its own resource budget; listening never changes teaching progress. */
export class SqliteSpeechLedger {
  constructor(
    private readonly db: DatabaseSync,
    private readonly now: () => number = Date.now,
  ) {}

  reserve(
    owner: string,
    requestId: string,
    characters: number,
    limits: { daily: number; global: number; leaseMs: number },
  ): string {
    const now = this.now();
    const day = new Date(now).toISOString().slice(0, 10);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      if (
        !this.db
          .prepare(
            "SELECT 1 FROM learners WHERE owner_hash = ? AND expires_at > ?",
          )
          .get(owner, now)
      )
        throw new AppError(
          "UNAUTHENTICATED",
          "Your guest session expired. Please reconnect.",
          401,
        );
      if (
        this.db
          .prepare(
            "SELECT 1 FROM speech_requests WHERE owner_hash = ? AND request_id = ?",
          )
          .get(owner, requestId)
      )
        throw new AppError(
          "CONFLICT",
          "This listening request was already used. Select Listen again to start a new request.",
          409,
        );
      const counts = this.db
        .prepare(
          "SELECT COUNT(*) AS total, COALESCE(SUM(owner_hash = ?), 0) AS owned FROM speech_requests WHERE day = ?",
        )
        .get(owner, day) as { total: number; owned: number };
      if (counts.owned >= limits.daily || counts.total >= limits.global)
        throw new AppError(
          "LIMIT_REACHED",
          "The daily voice allowance has been reached. You can still use your device voice.",
          429,
        );
      if (
        this.db
          .prepare(
            "SELECT 1 FROM speech_requests WHERE status = 'pending' AND lease_until > ? LIMIT 1",
          )
          .get(now)
      )
        throw new AppError(
          "LIMIT_REACHED",
          "Melissa’s voice is busy. Please try again in a moment.",
          429,
        );
      const id = randomUUID();
      this.db
        .prepare(
          "INSERT INTO speech_requests (id, owner_hash, request_id, day, status, lease_until, input_characters, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)",
        )
        .run(id, owner, requestId, day, now + limits.leaseMs, characters, now);
      this.db.exec("COMMIT");
      return id;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  complete(id: string): void {
    const result = this.db
      .prepare(
        "UPDATE speech_requests SET status = 'completed', lease_until = 0 WHERE id = ? AND status = 'pending' AND lease_until > ? AND owner_hash IN (SELECT owner_hash FROM learners WHERE expires_at > ?)",
      )
      .run(id, this.now(), this.now());
    if (result.changes !== 1)
      throw new AppError(
        "UNAUTHENTICATED",
        "This voice request expired. Please reconnect and try again.",
        401,
      );
  }

  fail(id: string): void {
    this.db
      .prepare(
        "UPDATE speech_requests SET status = 'failed', lease_until = 0 WHERE id = ? AND status = 'pending'",
      )
      .run(id);
  }
}
