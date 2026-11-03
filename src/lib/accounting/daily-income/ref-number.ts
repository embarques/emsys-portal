export type DailyIncomeRefNumberMode = "system" | "custom";

/** Portal-only mode: system omits `refNumber` so the API generates one. */
export function resolveDailyIncomeRefNumberMode(values: {
  refNumberMode?: DailyIncomeRefNumberMode;
  refNumber?: string | null;
}): DailyIncomeRefNumberMode {
  if (values.refNumberMode === "system" || values.refNumberMode === "custom") {
    return values.refNumberMode;
  }
  return values.refNumber?.trim() ? "custom" : "system";
}

/**
 * Value to send on journal create/update.
 * `undefined` means omit the field so the API can generate a reference.
 */
export function resolveJournalRefNumberForWrite(values: {
  refNumberMode?: DailyIncomeRefNumberMode;
  refNumber?: string | null;
}): string | undefined {
  if (resolveDailyIncomeRefNumberMode(values) === "system") return undefined;
  const trimmed = values.refNumber?.trim() ?? "";
  return trimmed || undefined;
}

/**
 * Value to send when creating a journal. A new Invoice (`INITIAL-PAYMENT`) in
 * system mode uses its invoice number; auto-numbered invoices omit it so the
 * API can apply the same default once the number is assigned.
 */
export function resolveJournalRefNumberForCreate(values: {
  transactionType?: string;
  refNumberMode?: DailyIncomeRefNumberMode;
  refNumber?: string | null;
  invoiceNumber?: string;
  autoGenerateInvoiceNumber?: boolean;
}): string | undefined {
  const explicit = resolveJournalRefNumberForWrite(values);
  if (explicit || resolveDailyIncomeRefNumberMode(values) === "custom") return explicit;
  if (values.transactionType !== "INITIAL-PAYMENT" || values.autoGenerateInvoiceNumber) return undefined;
  return values.invoiceNumber?.trim() || undefined;
}
