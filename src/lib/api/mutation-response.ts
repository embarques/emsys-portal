import type { PaginatedApiEnvelope } from "@/lib/api/types";

/** Throws when the API reports `success: false`, using a consistent message order. */
export function readMutationFailureMessage(
  response: PaginatedApiEnvelope<unknown>,
  fallbackMessage: string,
): string {
  const message = response.message?.trim();
  const error = response.error?.trim();

  if (message && error && message !== error) {
    return `${message}. ${error}`;
  }

  return error || message || fallbackMessage;
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
