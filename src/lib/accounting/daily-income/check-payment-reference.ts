/**
 * CHECK/CHEQUE journal payments: UI "Check number" maps to API `paymentReference`.
 * Legacy `checkNumber` is still dual-written/read while the live API accepts it.
 *
 * Keep values as strings so leading zeros survive. Never coerce with Number().
 * Do not fall back to journal/check `refNumber` — that is the internal transaction reference.
 */

/** Resolve the paper check # from a journal or check API row. */
export function resolveJournalCheckNumberFromApi(raw: {
  paymentReference?: unknown;
  checkNumber?: unknown;
  check_number?: unknown;
}): string | undefined {
  for (const value of [raw.paymentReference, raw.checkNumber, raw.check_number]) {
    if (value == null) continue;
    // Trim whitespace only — do not parse as a number (preserves leading zeros).
    const trimmed = String(value).trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

/**
 * Wire fields for a CHECK/CHEQUE journal write.
 * Prefers `paymentReference`; also sends `checkNumber` as a compatibility alias.
 */
export function buildJournalCheckPaymentWire(
  checkNumber: string | undefined,
): { paymentReference: string; checkNumber: string } | Record<string, never> {
  const trimmed = checkNumber?.trim() ?? "";
  if (!trimmed) return {};
  return {
    paymentReference: trimmed,
    checkNumber: trimmed,
  };
}

/**
 * Wire fields for a Checks directory document write.
 * Carries the paper check number through supported reference fields.
 */
export function buildCheckDocumentPaymentWire(
  checkNumber: string | undefined,
): { paymentReference: string; checkNumber: string } | Record<string, never> {
  return buildJournalCheckPaymentWire(checkNumber);
}

/** Prefer payment reference, then legacy check number — never internal refNumber. */
export function resolvePaymentReferenceForDisplay(input: {
  paymentReference?: string | null;
  checkNumber?: string | null;
}): string {
  return input.paymentReference?.trim() || input.checkNumber?.trim() || "";
}
