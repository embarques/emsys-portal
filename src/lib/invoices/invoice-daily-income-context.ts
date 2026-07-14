import type { DailyIncomeJournal } from "@/lib/accounting/daily-income/types";

/** Payment / Cuadre outcome from the invoice create wizard payment step. */
export type InvoiceDailyIncomeContext = {
  /** Journal entry when the user recorded a payment in Daily Income. */
  registration: DailyIncomeJournal | null;
  /**
   * Open Cuadre to associate with the invoice.
   * Set automatically when today's statement is OPEN, or after creating one.
   */
  incomeStatementId: number | null;
  /** User chose to continue without linking or recording a payment. */
  paymentSkipped: boolean;
};

export type InvoiceFormSubmitContext = {
  dailyIncomeRegistration: DailyIncomeJournal | null;
  incomeStatementId: number | null;
  paymentSkipped: boolean;
};

export function emptyInvoiceDailyIncomeContext(): InvoiceDailyIncomeContext {
  return {
    registration: null,
    incomeStatementId: null,
    /** Default: skip payment until the user unchecks the checkbox. */
    paymentSkipped: true,
  };
}

export function toInvoiceFormSubmitContext(
  context: InvoiceDailyIncomeContext,
): InvoiceFormSubmitContext {
  return {
    dailyIncomeRegistration: context.registration,
    incomeStatementId: context.incomeStatementId,
    paymentSkipped: context.paymentSkipped,
  };
}

/** Ready to leave the payment step: skipped, or payment recorded. */
export function canContinueInvoiceDailyIncomeStep(context: InvoiceDailyIncomeContext): boolean {
  return context.paymentSkipped || context.registration != null;
}
