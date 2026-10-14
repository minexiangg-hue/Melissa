import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  learningMaterialSchema,
  validateMaterialDraft,
} from "@/domain/learning/models";
import { readConfig } from "@/server/config";
import { AiMaterialProvider } from "@/server/learning/providers";
import { MaterialService } from "@/server/learning/service";
import { createStructuredGenerator } from "@/server/providers/factory";

for (const [kind, enabled] of [
  ["codex", process.env.MELISSA_LIVE_CODEX === "1"],
  ["openai-compatible", process.env.MELISSA_LIVE_API === "1"],
] as const) {
  it.skipIf(!enabled)(
    `generates a complete original material through live ${kind}`,
    async () => {
      const generator = createStructuredGenerator(
        readConfig({ ...process.env, TEACHER_PROVIDER: kind }),
      );
      const service = new MaterialService(new AiMaterialProvider(generator!));
      const material = await service.create(
        {
          level: "B1",
          goal: "work",
          topic:
            "explaining a delay in a design project and agreeing a new deadline",
          requestId: randomUUID(),
        },
        AbortSignal.timeout(90000),
      );
      expect(learningMaterialSchema.safeParse(material).success).toBe(true);
      const {
        title,
        summary,
        reading,
        dialogue,
        vocabulary,
        exercises,
        objectives,
      } = material;
      expect(
        validateMaterialDraft({
          title,
          summary,
          reading,
          dialogue,
          vocabulary,
          exercises,
          objectives,
        }),
      ).toBeTruthy();
      expect(material.provider).toBe(kind);
      expect(material.sourceIds).toContain("melissa-original");
      expect(material.reading.text.split(/\s+/).length).toBeGreaterThan(60);
      expect(material.reading.text.toLowerCase()).toMatch(
        /delay|deadline|late|extra time/,
      );
      const artifactDirectory = process.env.MELISSA_LIVE_ARTIFACT_DIR;
      if (artifactDirectory) {
        await mkdir(artifactDirectory, { recursive: true, mode: 0o700 });
        await writeFile(
          join(artifactDirectory, `material-${kind}.json`),
          `${JSON.stringify(material, null, 2)}\n`,
          { mode: 0o600 },
        );
      }
    },
    100000,
  );
}
