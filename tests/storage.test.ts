import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { freshState } from "@/domain/models";
import { SqliteLearnerRepository } from "@/server/storage/sqlite";
const dirs: string[] = [];
const connections: SqliteLearnerRepository[] = [];
function connect(path: string) {
  const db = new SqliteLearnerRepository(path);
  connections.push(db);
  return db;
}
afterEach(() => {
  connections.splice(0).forEach((db) => db.close());
  dirs
    .splice(0)
    .forEach((dir) => rmSync(dir, { recursive: true, force: true }));
});
describe("SQLite repository contract", () => {
  it("survives reopening and applies migrations idempotently", () => {
    const dir = mkdtempSync(join(tmpdir(), "yet-test-"));
    dirs.push(dir);
    const path = join(dir, "teacher.db");
    const a = connect(path);
    a.create("owner", freshState("2026-09-11"), Date.now() + 60000);
    const b = connect(path);
    expect(b.read("owner")).toEqual(freshState("2026-09-11"));
    expect(b.read("other-owner")).toBeNull();
    const state = a.read("owner")!;
    state.revision++;
    a.save("owner", 0, state);
    expect(() => b.save("owner", 0, state)).toThrow("changed");
    expect(b.read("owner")!.revision).toBe(1);
  });
  it("returns detached snapshots and atomically deletes only the expected owner revision", () => {
    const db = connect(":memory:");
    db.create("owner", freshState("2026-09-11"), Date.now() + 60000);
    const detached = db.read("owner")!;
    detached.usage.units = 900;
    expect(db.read("owner")!.usage.units).toBe(0);
    expect(() => db.delete("owner", 5)).toThrow("changed");
    db.delete("owner", 0);
    expect(db.read("owner")).toBeNull();
  });
  it("rejects expired credentials for reads, writes, and deletes", () => {
    const db = connect(":memory:");
    db.create("expired", freshState("2026-09-11"), Date.now() - 1);
    expect(db.read("expired")).toBeNull();
    expect(() =>
      db.save("expired", 0, { ...freshState("2026-09-11"), revision: 1 }),
    ).toThrow("expired");
    expect(() => db.delete("expired", 0)).toThrow("expired");
  });
});
