import type { PaginatedApiEnvelope } from "@/lib/api/types";

/** Reads the best user-facing message from a failed mutation envelope. */
export function readMutationFailureMessage(
  response: PaginatedApiEnvelope<unknown>,
  fallbackMessage: string,
): string {
  return response.message?.trim() || response.error?.trim() || fallbackMessage;
}

/** Throws when the API reports `success: false`, using a consistent message order. */
export function assertMutationSuccess(
  response: PaginatedApiEnvelope<unknown>,
  fallbackMessage: string,
): void {
  if (response.success === false) {
    throw new Error(readMutationFailureMessage(response, fallbackMessage));
  }
}
