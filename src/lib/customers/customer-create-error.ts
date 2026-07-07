import { normalizeApiError } from "@/lib/api/api-error";
import {
  formatUserErrorMessage,
  type FormatUserErrorOptions,
} from "@/lib/errors/format-user-error";
import type { TranslateFn } from "@/lib/feedback/messages";

export function isDuplicateCustomerError(error: unknown): boolean {
  return normalizeApiError(error).status === 409;
}

/** User-facing message for customer create/update failures (409 duplicate on create). */
export function formatCustomerMutationError(
  error: unknown,
  t: TranslateFn,
  options?: FormatUserErrorOptions & { mode?: "create" | "edit" },
): string {
  if (options?.mode === "create" && isDuplicateCustomerError(error)) {
    return t("customers.form.errors.duplicateCustomer");
  }

  return formatUserErrorMessage(error, t, options);
}
