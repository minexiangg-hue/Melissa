import type { Snapshot } from "@/domain/models";
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly requestId?: string,
  ) {
    super(message);
  }
}
export async function api<T = Snapshot>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "We couldn't reach the server. Your draft is still here. Please try again.",
      "NETWORK",
    );
  }
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error?.message ?? "The request failed. Please try again.",
      data.error?.code ?? "UNKNOWN",
      data.error?.requestId,
    );
  return data as T;
}
