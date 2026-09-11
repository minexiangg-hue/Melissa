import { randomBytes } from "node:crypto";
import { freshState, type Profile } from "@/domain/models";
import { SqliteLearnerRepository } from "@/server/storage/sqlite";
import { Orchestrator } from "@/server/orchestrator";
import { DemoGuard, DemoTeacher } from "@/server/providers/demo";
import type { TeacherProvider } from "@/domain/ports";
export const profile: Profile = {
  displayName: "Mei",
  nativeLanguage: "Chinese",
  level: "B1",
  goal: "everyday",
  dailyMinutes: 10,
};
export function fixture(
  options: {
    teacher?: TeacherProvider;
    dailyUnitLimit?: number;
    timeoutMs?: number;
  } = {},
) {
  let now = new Date("2026-09-11T12:00:00Z");
  const repository = new SqliteLearnerRepository(":memory:", () =>
    now.getTime(),
  );
  const owner = randomBytes(32).toString("hex");
  repository.create(
    owner,
    freshState("2026-09-11"),
    now.getTime() + 86400000 * 30,
  );
  const service = new Orchestrator(
    repository,
    new DemoGuard(),
    options.teacher ?? new DemoTeacher(),
    {
      dailyUnitLimit: options.dailyUnitLimit ?? 15000,
      timeoutMs: options.timeoutMs ?? 100,
      now: () => now,
    },
  );
  return {
    repository,
    owner,
    service,
    setNow: (value: string) => {
      now = new Date(value);
    },
    start: () => {
      const withProfile = service.updateProfile(owner, 0, profile);
      return service.startSession(
        owner,
        withProfile.state.revision,
        "everyday-b1",
      );
    },
  };
}
