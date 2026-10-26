import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { AppError, assertRevision } from "@/domain/errors";
import type { LearnerState } from "@/domain/models";
import type { LearnerRepository } from "@/domain/ports";
import { migrations } from "./migrations";
import { SqliteSpeechLedger } from "../speech/ledger";
import { SqliteInferenceLedger } from "../inference/ledger";

export class SqliteLearnerRepository implements LearnerRepository {
  private readonly db: DatabaseSync;
  readonly inference: SqliteInferenceLedger;
  readonly speech: SqliteSpeechLedger;
  private lastPrunedAt = 0;
  constructor(
    path: string,
    private readonly now: () => number = Date.now,
  ) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path, { timeout: 5000 });
    this.db.exec(
      "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;",
    );
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const version = (
        this.db.prepare("PRAGMA user_version").get() as { user_version: number }
      ).user_version;
      if (version > migrations.length)
        throw new Error("Database schema is newer than this application.");
      for (const migration of migrations) {
        if (migration.version > version) {
          this.db.exec(migration.sql);
          this.db.exec(`PRAGMA user_version=${migration.version}`);
        }
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      this.db.close();
      throw error;
    }
    this.inference = new SqliteInferenceLedger(this.db, this.now);
    this.speech = new SqliteSpeechLedger(this.db, this.now);
    this.pruneExpired();
  }
  private pruneExpired() {
    const now = this.now();
    if (now - this.lastPrunedAt < 60000) return;
    this.db.prepare("DELETE FROM learners WHERE expires_at <= ?").run(now);
    this.db
      .prepare(
        "DELETE FROM inference_requests WHERE owner_hash IS NULL AND day < ?",
      )
      .run(new Date(now).toISOString().slice(0, 10));
    this.db
      .prepare("DELETE FROM speech_requests WHERE day < ? AND lease_until <= ?")
      .run(new Date(now).toISOString().slice(0, 10), now);
    this.lastPrunedAt = now;
  }

  create(ownerHash: string, state: LearnerState, expiresAt: number) {
    this.db
      .prepare(
        "INSERT INTO learners (owner_hash, revision, state, expires_at) VALUES (?, ?, ?, ?)",
      )
      .run(ownerHash, state.revision, JSON.stringify(state), expiresAt);
  }
  read(ownerHash: string): LearnerState | null {
    this.pruneExpired();
    const row = this.db
      .prepare(
        "SELECT state FROM learners WHERE owner_hash = ? AND expires_at > ?",
      )
      .get(ownerHash, this.now()) as { state: string } | undefined;
    if (!row) return null;
    const state = JSON.parse(row.state) as LearnerState;
    if (state.schemaVersion !== 1)
      throw new Error("Unsupported learner data schema.");
    // Released v1 aggregates predate generated materials; preserve their identity and history.
    state.materials ??= [];
    return state;
  }
  expiresAt(ownerHash: string): number | null {
    this.pruneExpired();
    const row = this.db
      .prepare(
        "SELECT expires_at FROM learners WHERE owner_hash = ? AND expires_at > ?",
      )
      .get(ownerHash, this.now()) as { expires_at: number } | undefined;
    return row?.expires_at ?? null;
  }
  save(ownerHash: string, expectedRevision: number, next: LearnerState) {
    assertRevision(next.revision, expectedRevision + 1);
    const result = this.db
      .prepare(
        "UPDATE learners SET state = ?, revision = ? WHERE owner_hash = ? AND revision = ? AND expires_at > ?",
      )
      .run(
        JSON.stringify(next),
        next.revision,
        ownerHash,
        expectedRevision,
        this.now(),
      );
    if (result.changes !== 1)
      throw new AppError(
        "CONFLICT",
        "Your practice changed or expired. Refresh and try again.",
        409,
      );
  }
  delete(ownerHash: string, expectedRevision: number) {
    const result = this.db
      .prepare(
        "DELETE FROM learners WHERE owner_hash = ? AND revision = ? AND expires_at > ?",
      )
      .run(ownerHash, expectedRevision, this.now());
    if (result.changes !== 1)
      throw new AppError(
        "CONFLICT",
        "Your practice changed or expired. Refresh and try again.",
        409,
      );
  }
  close() {
    this.db.close();
  }
}
