import { z } from "zod";

export const MAX_SPEECH_CHARACTERS = 1600;
export const speechRequestSchema = z
  .object({
    requestId: z.uuid(),
    text: z.string().trim().min(1).max(MAX_SPEECH_CHARACTERS),
  })
  .strict();
