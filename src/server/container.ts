import "server-only";
import { readConfig } from "./config";
import { SqliteLearnerRepository } from "./storage/sqlite";
import { DemoGuard, DemoTeacher } from "./providers/demo";
import { createStructuredGenerator } from "./providers/factory";
import { AiTeacher } from "./providers/ai-teacher";
import { InferenceCoordinator } from "./inference/coordinator";
import { AiMaterialProvider, DemoMaterialProvider } from "./learning/providers";
import { MaterialService } from "./learning/service";
import { KokoroSpeechProvider } from "./speech/provider";
import { SpeechService } from "./speech/service";
import { Orchestrator } from "./orchestrator";
function createContainer() {
  const config = readConfig();
  const repository = new SqliteLearnerRepository(config.DATABASE_PATH);
  const transport = createStructuredGenerator(config);
  const inference = transport
    ? new InferenceCoordinator(repository.inference, {
        daily: config.DAILY_AI_REQUEST_LIMIT,
        global: config.GLOBAL_DAILY_AI_REQUEST_LIMIT,
        leaseMs: config.PROVIDER_TIMEOUT_MS + 60000,
      })
    : undefined;
  const generator =
    transport && inference ? inference.metered(transport) : null;
  const materials = new MaterialService(
    generator ? new AiMaterialProvider(generator) : new DemoMaterialProvider(),
  );
  const speech =
    config.SPEECH_PROVIDER === "kokoro"
      ? new SpeechService(
          new KokoroSpeechProvider({
            baseUrl: config.SPEECH_BASE_URL,
            token: config.SPEECH_API_TOKEN!,
            voice: "af_heart",
            speed: 0.9,
            timeoutMs: config.SPEECH_TIMEOUT_MS,
          }),
          repository,
          repository.speech,
          {
            daily: config.SPEECH_DAILY_REQUEST_LIMIT,
            global: config.SPEECH_GLOBAL_DAILY_REQUEST_LIMIT,
            timeoutMs: config.SPEECH_TIMEOUT_MS,
          },
        )
      : undefined;
  const orchestrator = new Orchestrator(
    repository,
    new DemoGuard(),
    generator ? new AiTeacher(generator) : new DemoTeacher(),
    {
      dailyUnitLimit: config.DAILY_DEMO_UNIT_LIMIT,
      timeoutMs: config.PROVIDER_TIMEOUT_MS,
      teacherKind: config.TEACHER_PROVIDER,
      textToSpeech: Boolean(speech),
      materials,
      inference,
    },
  );
  return { config, repository, orchestrator, speech };
}
// Survives development hot reloads; initialization stays out of the build phase.
const globalContainer = globalThis as typeof globalThis & {
  melissaContainer?: ReturnType<typeof createContainer>;
};
export function getContainer() {
  return (globalContainer.melissaContainer ??= createContainer());
}
