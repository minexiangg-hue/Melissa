import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { AppError } from "@/domain/errors";
import type {
  GenerationRequest,
  StructuredGenerator,
} from "../providers/structured";
import { SqliteInferenceLedger, type InferenceRequest } from "./ledger";

/** Keeps billing metadata outside prompts and applies one durable lease to a learning action. */
export class InferenceCoordinator {
  private readonly current = new AsyncLocalStorage<string>();
  constructor(
    private readonly ledger: SqliteInferenceLedger,
    private readonly limits: { daily: number; global: number; leaseMs: number },
  ) {}
  assertAvailable(owner: string) {
    this.ledger.assertAvailable(owner);
  }
  idle<T>(owner: string, operation: () => T): T {
    return this.ledger.withIdle(owner, operation);
  }
  usage(owner: string) {
    return this.ledger.usage(owner, this.limits.daily);
  }
  async run<T, R>(
    request: InferenceRequest,
    operation: () => Promise<T>,
    commit: (result: T) => R,
  ): Promise<R> {
    const reservation = this.ledger.reserve(request, this.limits);
    try {
      const result = await this.current.run(reservation.id, operation);
      return this.ledger.finalize(reservation.id, () => commit(result));
    } catch (error) {
      this.ledger.fail(reservation.id);
      if (
        error instanceof AppError &&
        ["LIMIT_REACHED", "CONFLICT", "VALIDATION", "INPUT_BLOCKED"].includes(
          error.code,
        )
      )
        throw error;
      // A network timeout cannot establish that the upstream never billed. Keep the attempt.
      throw new AppError(
        "RETRY_REQUIRED",
        "Melissa could not finish this attempt. Your work is safe; please try sending again.",
        503,
      );
    }
  }
  metered(generator: StructuredGenerator): StructuredGenerator {
    return {
      kind: generator.kind,
      generate: async <T>(
        request: GenerationRequest<T>,
        signal: AbortSignal,
      ) => {
        const id = this.current.getStore();
        if (!id)
          throw new Error(
            "AI generation requires a durable inference reservation.",
          );
        const result = await generator.generate(request, signal);
        this.ledger.recordUsage(id, result.usage, result.requestId);
        return result;
      },
    };
  }
}
