"use client";

import { useCallback } from "react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import {
  formatUserError,
  formatUserErrorMessage,
  type FormatUserErrorOptions,
  type UserError,
} from "@/lib/errors/format-user-error";
import { useTranslation } from "@/lib/i18n";

/**
 * Standard error helpers for workspaces and forms.
 *
 * Prefer `formatError` / `notifyApiError` over calling `normalizeApiError` directly
 * so system errors stay localized and consistently worded.
 */
export function useUserError() {
  const { t } = useTranslation();
  const { notifyError } = useFeedback();

  const formatError = useCallback(
    (error: unknown, options?: FormatUserErrorOptions): UserError =>
      formatUserError(error, t, options),
    [t],
  );

  const toErrorMessage = useCallback(
    (error: unknown, options?: FormatUserErrorOptions): string =>
      formatUserErrorMessage(error, t, options),
    [t],
  );

  const notifyApiError = useCallback(
    (error: unknown, options?: FormatUserErrorOptions) => {
      notifyError(formatUserErrorMessage(error, t, options));
    },
    [notifyError, t],
  );

  return {
    formatError,
    toErrorMessage,
    notifyApiError,
  };
}
