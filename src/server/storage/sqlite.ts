import "server-only";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { AppError, assertRevision } from "@/domain/errors";
import type { LearnerState } from "@/domain/models";
import type { LearnerRepository } from "@/domain/ports";
import { migrations } from "./migrations";

export class SqliteLearnerRepository implements LearnerRepository {
  private readonly db: DatabaseSync;
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
    this.db
      .prepare("DELETE FROM learners WHERE expires_at <= ?")
      .run(this.now());
  }
  create(ownerHash: string, state: LearnerState, expiresAt: number) {
    this.db
      .prepare(
        "INSERT INTO learners (owner_hash, revision, state, expires_at) VALUES (?, ?, ?, ?)",
      )
      .run(ownerHash, state.revision, JSON.stringify(state), expiresAt);
  }
  read(ownerHash: string): LearnerState | null {
    const row = this.db
      .prepare(
        "SELECT state FROM learners WHERE owner_hash = ? AND expires_at > ?",
      )
      .get(ownerHash, this.now()) as { state: string } | undefined;
    if (!row) return null;
    const state = JSON.parse(row.state) as LearnerState;
    if (state.schemaVersion !== 1)
      throw new Error("Unsupported learner data schema.");
    return state;
  }
  expiresAt(ownerHash: string): number | null {
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
