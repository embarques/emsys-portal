import axios, { type AxiosError } from "axios";

import { normalizeApiError } from "@/lib/api/api-error";
import {
  formatUserErrorMessage,
  type FormatUserErrorOptions,
} from "@/lib/errors/format-user-error";
import type { TranslateFn } from "@/lib/feedback/messages";

export function isDuplicateCustomerError(error: unknown): boolean {
  return normalizeApiError(error).status === 409;
}

type CustomerDuplicateConflict = {
  matchedBy: string[];
  existingCustomerId: string;
};

function readCustomerDuplicateConflict(error: unknown): CustomerDuplicateConflict | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null;

  const data = (error as AxiosError<unknown>).response?.data;
  if (data == null || typeof data !== "object") return null;

  const payload = data as Record<string, unknown>;
  const matchedBy = Array.isArray(payload.matchedBy)
    ? payload.matchedBy.filter((field): field is string => typeof field === "string")
    : [];
  const existingCustomerId =
    typeof payload.existingCustomerId === "string" ? payload.existingCustomerId.trim() : "";

  if (matchedBy.length === 0 || existingCustomerId === "") return null;
  return { matchedBy, existingCustomerId };
}

/** User-facing message for customer create/update failures (409 duplicate on create). */
export function formatCustomerMutationError(
  error: unknown,
  t: TranslateFn,
  options?: FormatUserErrorOptions & { mode?: "create" | "edit" },
): string {
  if (options?.mode === "create" && isDuplicateCustomerError(error)) {
    const conflict = readCustomerDuplicateConflict(error);
    if (conflict) {
      const matchedFields = conflict.matchedBy
        .map((field) => t("customers.form.errors.duplicateFields." + field))
        .join(", ");
      return t("customers.form.errors.duplicateCustomerDetails", {
        matchedFields,
        customerId: conflict.existingCustomerId,
      });
    }
    return t("customers.form.errors.duplicateCustomer");
  }

  return formatUserErrorMessage(error, t, options);
}
