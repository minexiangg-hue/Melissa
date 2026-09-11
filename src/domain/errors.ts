export type ErrorCode =
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "LIMIT_REACHED"
  | "INPUT_BLOCKED"
  | "PROVIDER_UNAVAILABLE"
  | "INTERNAL";
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}
export function assertRevision(actual: number, expected: number) {
  if (actual !== expected)
    throw new AppError(
      "CONFLICT",
      "Your practice changed in another tab. Refresh and try again.",
      409,
    );
}
