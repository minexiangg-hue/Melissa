import "server-only";
import { readConfig } from "./config";
import { SqliteLearnerRepository } from "./storage/sqlite";
import { DemoGuard, DemoTeacher } from "./providers/demo";
import { Orchestrator } from "./orchestrator";
function createContainer() {
  const config = readConfig();
  const repository = new SqliteLearnerRepository(config.DATABASE_PATH);
  const orchestrator = new Orchestrator(
    repository,
    new DemoGuard(),
    new DemoTeacher(),
    {
      dailyUnitLimit: config.DAILY_DEMO_UNIT_LIMIT,
      timeoutMs: config.PROVIDER_TIMEOUT_MS,
    },
  );
  return { config, repository, orchestrator };
}
// Survives development hot reloads; initialization stays out of the build phase.
const globalContainer = globalThis as typeof globalThis & {
  teacherContainer?: ReturnType<typeof createContainer>;
};
export function getContainer() {
  return (globalContainer.teacherContainer ??= createContainer());
}
