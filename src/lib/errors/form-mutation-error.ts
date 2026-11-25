import axios from "axios";

import { classifyApiError } from "@/lib/api/api-error";
import { isStaleMutation } from "@/lib/api/mutation-version";
import {
  formatUserErrorMessage,
  type FormatUserErrorOptions,
} from "@/lib/errors/format-user-error";
import type { TranslateFn } from "@/lib/feedback/messages";

export type FormatFormMutationErrorOptions = FormatUserErrorOptions & {
  /**
   * Feature-specific conflict / business message (e.g. customer duplicate details).
   * Return a non-empty string to use it; return null/undefined to fall through.
   */
  formatConflict?: (error: unknown) => string | null | undefined;
};

export type ApiFieldError = {
  field: string;
  message: string;
};

/** Minimal RHF-compatible target for applying server field errors. */
export type FormFieldErrorTarget = {
  // RHF FieldPath is generic per form values; callers pass their form instance.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setError: (name: any, error: { type?: string; message?: string }) => void;
};

function isOpaqueConflictMessage(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return true;
  if (/^Request failed( \(\d+\))?\.?$/i.test(trimmed)) return true;
  if (/^Request failed with status code \d+$/i.test(trimmed)) return true;
  if (/^(Invalid request|Conflict)$/i.test(trimmed)) return true;
  return false;
}

/**
 * Single entry for add/edit form catch blocks.
 *
 * Order: stale (412/428) → feature conflict formatter → generic 409 → localized user error.
 */
export function formatFormMutationError(
  error: unknown,
  t: TranslateFn,
  options?: FormatFormMutationErrorOptions,
): string {
  if (isStaleMutation(error)) {
    return t("common.form.staleUpdate");
  }

  const conflict = options?.formatConflict?.(error);
  if (typeof conflict === "string" && conflict.trim()) {
    return conflict.trim();
  }

  const classified = classifyApiError(error);
  const message = formatUserErrorMessage(error, t, { hint: options?.hint });

  if (classified.status === 409 && isOpaqueConflictMessage(classified.message)) {
    return t("common.form.conflict");
  }

  return message;
}

function fieldNameFromEntry(entry: Record<string, unknown>): string | null {
  if (typeof entry.field === "string" && entry.field.trim()) {
    return entry.field.trim();
  }
  if (typeof entry.path === "string" && entry.path.trim()) {
    return entry.path.trim();
  }
  if (Array.isArray(entry.path)) {
    const parts = entry.path.filter((part): part is string | number => {
      return typeof part === "string" || typeof part === "number";
    });
    if (parts.length === 0) return null;
    return parts.map(String).join(".");
  }
  return null;
}

/**
 * Forward-compatible reader for optional API field-error arrays.
 * Current EMSYS API bodies do not include `errors[]`; returns [] when absent.
 */
export function readApiFieldErrors(error: unknown): ApiFieldError[] {
  if (!axios.isAxiosError(error)) return [];

  const data = error.response?.data;
  if (data == null || typeof data !== "object") return [];

  const payload = data as Record<string, unknown>;
  const raw = payload.errors ?? payload.details;
  if (!Array.isArray(raw)) return [];

  const results: ApiFieldError[] = [];
  for (const item of raw) {
    if (item == null || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;
    const field = fieldNameFromEntry(entry);
    const message =
      typeof entry.message === "string"
        ? entry.message.trim()
        : typeof entry.error === "string"
          ? entry.error.trim()
          : "";
    if (!field || !message) continue;
    results.push({ field, message });
  }
  return results;
}

/**
 * Maps API field errors onto RHF. Returns true when at least one field was set
 * so the caller can skip the form-level banner.
 */
export function applyApiFieldErrors(
  form: FormFieldErrorTarget,
  error: unknown,
): boolean {
  const fieldErrors = readApiFieldErrors(error);
  if (fieldErrors.length === 0) return false;

  for (const fieldError of fieldErrors) {
    form.setError(fieldError.field, {
      type: "server",
      message: fieldError.message,
    });
  }
  return true;
}
