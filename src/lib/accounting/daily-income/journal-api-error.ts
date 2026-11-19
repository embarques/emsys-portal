import axios from "axios";
import { normalizeApiError } from "@/lib/api/api-error";
import { translateCurrent as localizedMessage } from "@/lib/i18n/translate-current";

/** Map known journal API codes to operator-facing copy. */
export function mapDailyIncomeJournalErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (/INVALID_DAILY_ROUTE/i.test(trimmed)) {
    return localizedMessage("accounting.dailyIncome.errors.invalidDailyRoute");
  }
  if (/INITIAL_PAYMENT_ASSIGNEE_REQUIRED|TRANSACTION_EMPLOYEE_REQUIRED|INVOICE_EMPLOYEE_LINK_REQUIRED/i.test(trimmed)) {
    return localizedMessage("accounting.dailyIncome.errors.responsibilityRequired");
  }
  if (/AMBIGUOUS_PAYMENT_INVOICE_NUMBER/.test(trimmed)) return localizedMessage("accounting.dailyIncome.errors.paymentInvoiceAmbiguous");
  if (/INVALID_PAYMENT_INVOICE_NUMBER|INVALID_PAYMENT_INVOICE_RESPONSE/.test(trimmed)) return localizedMessage("accounting.dailyIncome.errors.paymentInvoiceInvalid");
  return trimmed;
}

export function normalizeDailyIncomeJournalError(error: unknown): string {
  if (axios.isAxiosError<{ message?: string; data?: { code?: string } }>(error)) {
    const code = error.response?.data?.data?.code ?? error.response?.data?.message;
    if (code && /INITIAL_PAYMENT_ASSIGNEE_REQUIRED|TRANSACTION_EMPLOYEE_REQUIRED|INVOICE_EMPLOYEE_LINK_REQUIRED|AMBIGUOUS_PAYMENT_INVOICE_NUMBER|INVALID_PAYMENT_INVOICE_NUMBER/.test(code)) {
      return mapDailyIncomeJournalErrorMessage(code);
    }
  }
  return mapDailyIncomeJournalErrorMessage(normalizeApiError(error).message);
}
