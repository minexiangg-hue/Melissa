import "server-only";
import { AppError } from "@/domain/errors";
import type { LearnerRepository, TextToSpeechProvider } from "@/domain/ports";
import type { LearningMaterial } from "@/domain/learning/models";
import { speechRequestSchema } from "@/domain/speech";
import { SqliteSpeechLedger } from "./ledger";

export class SpeechService {
  private readonly pending = new Map<string, AbortController>();
  constructor(
    private readonly provider: TextToSpeechProvider,
    private readonly repository: LearnerRepository,
    private readonly ledger: SqliteSpeechLedger,
    private readonly limits: {
      daily: number;
      global: number;
      timeoutMs: number;
    },
  ) {}

  cancel(owner: string): void {
    this.pending.get(owner)?.abort();
  }

  async synthesize(owner: string, input: unknown, signal: AbortSignal) {
    const { text, requestId } = speechRequestSchema.parse(input);
    if (
      Buffer.byteLength(text, "utf8") > 8192 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)
    )
      throw new AppError(
        "VALIDATION",
        "Please choose a shorter passage of ordinary text.",
        422,
      );
    const state = this.repository.read(owner);
    if (!state)
      throw new AppError(
        "UNAUTHENTICATED",
        "Your guest session expired. Please reconnect.",
        401,
      );
    const texts: string[] = [];
    const addMaterial = (m: Pick<LearningMaterial, "reading" | "dialogue">) => {
      texts.push(
        m.reading.text,
        m.dialogue.map((line) => `${line.speaker}: ${line.text}`).join("\n"),
      );
    };
    for (const material of state.materials) addMaterial(material);
    for (const session of state.sessions) {
      for (const message of session.messages)
        if (message.role === "assistant") texts.push(message.text);
      if (session.lesson.material) addMaterial(session.lesson.material);
    }
    if (!texts.some((source) => source.includes(text)))
      throw new AppError(
        "FORBIDDEN",
        "Choose a passage from your saved lesson or Melissa’s replies.",
        403,
      );
    signal.throwIfAborted();
    const id = this.ledger.reserve(owner, requestId, text.length, {
      daily: this.limits.daily,
      global: this.limits.global,
      leaseMs: this.limits.timeoutMs + 5000,
    });
    const controller = new AbortController();
    this.pending.set(owner, controller);
    const deadline = AbortSignal.any([
      signal,
      controller.signal,
      AbortSignal.timeout(this.limits.timeoutMs),
    ]);
    try {
      // The Kokoro adapter resolves only after its bounded WAV is fully received and validated.
      const result = await this.provider.synthesize(text, deadline);
      deadline.throwIfAborted();
      this.ledger.complete(id);
      return result;
    } catch (error) {
      this.ledger.fail(id);
      if (error instanceof AppError) throw error;
      throw new AppError(
        "PROVIDER_UNAVAILABLE",
        "Melissa’s voice could not finish. Try again or use your device voice.",
        503,
      );
    } finally {
      if (this.pending.get(owner) === controller) this.pending.delete(owner);
    }
  }
}
