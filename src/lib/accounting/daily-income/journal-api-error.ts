import axios from "axios";
import { normalizeApiError } from "@/lib/api/api-error";
import { translateCurrent as localizedMessage } from "@/lib/i18n/translate-current";

const RESPONSIBILITY_REQUIRED_CODE =
  /INITIAL_PAYMENT_ASSIGNEE_REQUIRED|TRANSACTION_EMPLOYEE_REQUIRED|INVOICE_EMPLOYEE_LINK_REQUIRED/i;

export type DailyIncomeJournalErrorOptions = {
  /** User can open `/employees` and link a user on an employee record. */
  canManageEmployees?: boolean;
};

export type DailyIncomeJournalErrorPresentation = {
  message: string;
  recovery: "employees" | null;
};

function apiErrorCode(error: unknown): string | null {
  if (!axios.isAxiosError<{ message?: string; data?: { code?: string } }>(error)) return null;
  return error.response?.data?.data?.code ?? error.response?.data?.message ?? null;
}

export function isResponsibilityRequiredJournalError(error: unknown): boolean {
  const code = apiErrorCode(error);
  if (code && RESPONSIBILITY_REQUIRED_CODE.test(code)) return true;
  return RESPONSIBILITY_REQUIRED_CODE.test(normalizeApiError(error).message);
}

/** True when `message` is one of the localized responsibility-required strings. */
export function isResponsibilityRequiredErrorMessage(message: string | null | undefined): boolean {
  if (!message?.trim()) return false;
  const trimmed = message.trim();
  return (
    trimmed === localizedMessage("accounting.dailyIncome.errors.responsibilityRequired") ||
    trimmed === localizedMessage("accounting.dailyIncome.errors.responsibilityRequiredOpenEmployees") ||
    trimmed === localizedMessage("accounting.dailyIncome.errors.responsibilityRequiredContactAdmin")
  );
}

export function presentDailyIncomeJournalError(
  error: unknown,
  options: DailyIncomeJournalErrorOptions = {},
): DailyIncomeJournalErrorPresentation {
  if (isResponsibilityRequiredJournalError(error)) {
    const canManageEmployees = Boolean(options.canManageEmployees);
    return {
      message: localizedMessage(
        canManageEmployees
          ? "accounting.dailyIncome.errors.responsibilityRequiredOpenEmployees"
          : "accounting.dailyIncome.errors.responsibilityRequiredContactAdmin",
      ),
      recovery: canManageEmployees ? "employees" : null,
    };
  }

  return { message: mapDailyIncomeJournalErrorMessage(normalizeApiError(error).message), recovery: null };
}

/** Map known journal API codes to operator-facing copy. */
export function mapDailyIncomeJournalErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (/INVALID_DAILY_ROUTE/i.test(trimmed)) {
    return localizedMessage("accounting.dailyIncome.errors.invalidDailyRoute");
  }
  if (RESPONSIBILITY_REQUIRED_CODE.test(trimmed)) {
    return localizedMessage("accounting.dailyIncome.errors.responsibilityRequiredContactAdmin");
  }
  if (/AMBIGUOUS_PAYMENT_INVOICE_NUMBER/.test(trimmed)) {
    return localizedMessage("accounting.dailyIncome.errors.paymentInvoiceAmbiguous");
  }
  if (/INVALID_PAYMENT_INVOICE_NUMBER|INVALID_PAYMENT_INVOICE_RESPONSE/.test(trimmed)) {
    return localizedMessage("accounting.dailyIncome.errors.paymentInvoiceInvalid");
  }
  return trimmed;
}

export function normalizeDailyIncomeJournalError(
  error: unknown,
  options: DailyIncomeJournalErrorOptions = {},
): string {
  if (isResponsibilityRequiredJournalError(error)) {
    return presentDailyIncomeJournalError(error, options).message;
  }
  if (axios.isAxiosError<{ message?: string; data?: { code?: string } }>(error)) {
    const code = apiErrorCode(error);
    if (
      code &&
      /AMBIGUOUS_PAYMENT_INVOICE_NUMBER|INVALID_PAYMENT_INVOICE_NUMBER/.test(code)
    ) {
      return mapDailyIncomeJournalErrorMessage(code);
    }
  }
  return mapDailyIncomeJournalErrorMessage(normalizeApiError(error).message);
}
