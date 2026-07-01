import { classifyApiError, type ApiErrorCategory } from "@/lib/api/api-error";
import type { TranslateFn } from "@/lib/feedback/messages";

export type FormatUserErrorOptions = {
  /** Appended after the primary message (e.g. permission guidance). */
  hint?: string;
};

export type UserError = {
  message: string;
  status?: number;
  category: ApiErrorCategory;
  isConnectivityFailure: boolean;
};

function localizedSystemMessage(
  t: TranslateFn,
  category: ApiErrorCategory,
  status: number | undefined,
): string | undefined {
  switch (category) {
    case "unreachable":
      return t("common.errors.api.unreachable");
    case "temporary_unavailable":
      return t("common.errors.api.temporaryUnavailable", { status: status ?? 0 });
    case "auth":
      return t("common.errors.api.sessionExpired");
    case "forbidden":
      return t("common.errors.api.forbidden");
    default:
      return undefined;
  }
}

function isGenericRequestFailedMessage(message: string): boolean {
  return /^Request failed( \(\d+\))?\.?$/i.test(message.trim());
}

/**
 * Formats any thrown/rejected value into a consistent, localized user-facing message.
 *
 * - System errors (network, auth, generic HTTP) use catalog templates.
 * - API/business errors preserve the server-provided message when available.
 */
export function formatUserError(
  error: unknown,
  t: TranslateFn,
  options?: FormatUserErrorOptions,
): UserError {
  const classified = classifyApiError(error);

  const systemMessage = localizedSystemMessage(t, classified.category, classified.status);

  let message: string;
  if (systemMessage && classified.category !== "forbidden") {
    message = systemMessage;
  } else if (classified.category === "forbidden" && systemMessage) {
    const detail = classified.message.trim();
    const isGenericForbidden =
      detail ===
      "This action is forbidden. Your account may lack the required permission, or your session may have expired — try signing out and back in.";
    message = isGenericForbidden ? systemMessage : detail;
  } else if (isGenericRequestFailedMessage(classified.message)) {
    message = classified.status
      ? t("common.errors.api.requestFailedWithStatus", { status: classified.status })
      : t("common.errors.api.requestFailed");
  } else {
    message = classified.message.trim() || t("common.errors.fallback");
  }

  if (options?.hint?.trim()) {
    message = `${message} ${options.hint.trim()}`;
  }

  return {
    message,
    status: classified.status,
    category: classified.category,
    isConnectivityFailure: classified.isConnectivityFailure,
  };
}

/** Convenience helper when only the message string is needed. */
export function formatUserErrorMessage(
  error: unknown,
  t: TranslateFn,
  options?: FormatUserErrorOptions,
): string {
  return formatUserError(error, t, options).message;
}
