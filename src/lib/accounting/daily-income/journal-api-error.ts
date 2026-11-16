import { normalizeApiError } from "@/lib/api/api-error";
import { translateCurrent as localizedMessage } from "@/lib/i18n/translate-current";

/** Map known journal API codes to operator-facing copy. */
export function mapDailyIncomeJournalErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (/INVALID_DAILY_ROUTE/i.test(trimmed)) {
    return localizedMessage("accounting.dailyIncome.errors.invalidDailyRoute");
  }
  return trimmed;
}

export function normalizeDailyIncomeJournalError(error: unknown): string {
  return mapDailyIncomeJournalErrorMessage(normalizeApiError(error).message);
}
