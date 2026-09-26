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
