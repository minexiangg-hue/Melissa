import "server-only";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { AppError, assertRevision } from "@/domain/errors";

export interface InferenceRequest {
  owner: string;
  requestId: string;
  fingerprint: string;
  revision: number;
}
interface Row {
  id: string;
  fingerprint: string;
  status: "pending" | "completed" | "failed";
}
/** Shares the learner database transaction boundary; never holds a transaction over inference. */
export class SqliteInferenceLedger {
  constructor(
    private readonly db: DatabaseSync,
    private readonly now: () => number = Date.now,
  ) {}

  assertAvailable(owner: string) {
    const active = this.db
      .prepare(
        "SELECT 1 FROM inference_requests WHERE owner_hash = ? AND status = 'pending' AND lease_until > ? LIMIT 1",
      )
      .get(owner, this.now());
    if (active)
      throw new AppError(
        "CONFLICT",
        "Melissa is still preparing your response. Please wait a moment.",
        409,
      );
  }

  withIdle<T>(owner: string, operation: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.assertAvailable(owner);
      const result = operation();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  reserve(
    request: InferenceRequest,
    limits: { daily: number; global: number; leaseMs: number },
  ): { id: string } {
    const now = this.now();
    const day = new Date(now).toISOString().slice(0, 10);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const owner = this.db
        .prepare(
          "SELECT revision FROM learners WHERE owner_hash = ? AND expires_at > ?",
        )
        .get(request.owner, now) as { revision: number } | undefined;
      if (!owner)
        throw new AppError(
          "UNAUTHENTICATED",
          "Your guest session expired. Refresh to start again.",
          401,
        );
      const previous = this.db
        .prepare(
          "SELECT id, fingerprint, status FROM inference_requests WHERE owner_hash = ? AND request_id = ?",
        )
        .get(request.owner, request.requestId) as Row | undefined;
      if (previous) {
        if (previous.fingerprint !== request.fingerprint)
          throw new AppError(
            "CONFLICT",
            "This request identifier was already used for a different action.",
            409,
          );
        if (previous.status === "completed") {
          throw new AppError(
            "CONFLICT",
            "This action already finished. Refresh to see your saved work.",
            409,
          );
        }
        this.assertAvailable(request.owner);
        throw new AppError(
          "RETRY_REQUIRED",
          "This attempt could not be recovered. Please send it again.",
          503,
        );
      }
      assertRevision(owner.revision, request.revision);
      this.assertAvailable(request.owner);
      const usage = this.usage(request.owner, limits.daily);
      const global = this.db
        .prepare(
          "SELECT count(*) AS count FROM inference_requests WHERE day = ?",
        )
        .get(day) as { count: number };
      if (usage.requests >= limits.daily || global.count >= limits.global)
        throw new AppError(
          "LIMIT_REACHED",
          "Today's AI allowance is used up. Please come back after midnight UTC.",
          429,
        );
      const id = randomUUID();
      this.db
        .prepare(
          "INSERT INTO inference_requests (id, owner_hash, request_id, fingerprint, day, status, lease_until, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)",
        )
        .run(
          id,
          request.owner,
          request.requestId,
          request.fingerprint,
          day,
          now + limits.leaseMs,
          now,
        );
      this.db.exec("COMMIT");
      return { id };
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  recordUsage(
    id: string,
    usage: { inputTokens: number; outputTokens: number } | null,
    providerRequestId?: string,
  ) {
    this.db
      .prepare(
        "UPDATE inference_requests SET input_tokens = input_tokens + ?, output_tokens = output_tokens + ?, provider_request_id = ?, usage_unknown = ? WHERE id = ? AND status = 'pending' AND owner_hash IS NOT NULL",
      )
      .run(
        usage?.inputTokens ?? 0,
        usage?.outputTokens ?? 0,
        providerRequestId?.slice(0, 200) ?? null,
        usage === null ? 1 : 0,
        id,
      );
  }

  finalize<T>(id: string, commit: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const pending = this.db
        .prepare(
          "SELECT 1 FROM inference_requests WHERE id = ? AND status = 'pending' AND owner_hash IS NOT NULL AND lease_until > ?",
        )
        .get(id, this.now());
      if (!pending)
        throw new AppError(
          "CONFLICT",
          "Your learning data changed. Refresh and try again.",
          409,
        );
      const result = commit();
      this.db
        .prepare(
          "UPDATE inference_requests SET status = 'completed', lease_until = 0 WHERE id = ?",
        )
        .run(id);
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  fail(id: string) {
    this.db
      .prepare(
        "UPDATE inference_requests SET status = 'failed', lease_until = 0 WHERE id = ? AND status = 'pending'",
      )
      .run(id);
  }

  usage(owner: string, limit: number) {
    const day = new Date(this.now()).toISOString().slice(0, 10);
    const row = this.db
      .prepare(
        "SELECT count(*) AS requests, coalesce(sum(input_tokens), 0) AS inputTokens, coalesce(sum(output_tokens), 0) AS outputTokens, coalesce(sum(usage_unknown), 0) AS unknownUsageRequests FROM inference_requests WHERE owner_hash = ? AND day = ?",
      )
      .get(owner, day) as {
      requests: number;
      inputTokens: number;
      outputTokens: number;
      unknownUsageRequests: number;
    };
    return { ...row, limit };
  }
}
