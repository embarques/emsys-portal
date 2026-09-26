/**
 * CHECK/CHEQUE journal payments: UI "Check number" maps to API `paymentReference`.
 * Legacy `checkNumber` is still dual-written/read while the live API accepts it.
 */

/** Resolve the paper check # from a journal API row. */
export function resolveJournalCheckNumberFromApi(raw: {
  paymentReference?: unknown;
  checkNumber?: unknown;
  check_number?: unknown;
}): string | undefined {
  for (const value of [raw.paymentReference, raw.checkNumber, raw.check_number]) {
    if (value == null) continue;
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

/** Prefer payment reference, then check number, then internal ref for display mapping. */
export function resolvePaymentReferenceForDisplay(input: {
  paymentReference?: string | null;
  checkNumber?: string | null;
  refNumber?: string | null;
}): string {
  return (
    input.paymentReference?.trim() ||
    input.checkNumber?.trim() ||
    input.refNumber?.trim() ||
    ""
  );
}
