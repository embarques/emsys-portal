import type { DailyIncomeJournal } from "@/lib/accounting/daily-income/types";

/** Payment / Cuadre outcome from the invoice create wizard payment step. */
export type InvoiceDailyIncomeContext = {
  /** Journal entry when the user recorded a payment in Daily Income (amount may be $0). */
  registration: DailyIncomeJournal | null;
  /**
   * Open Cuadre associated with the invoice registration.
   * Set from the recorded journal / today's open statement.
   */
  incomeStatementId: number | null;
  /** True when no payment was collected, either by explicit skip or a $0 registration. */
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
    paymentSkipped: false,
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

/** Ready to leave the payment step after either recording or skipping against an open Cuadre. */
export function canContinueInvoiceDailyIncomeStep(context: InvoiceDailyIncomeContext): boolean {
  return context.registration != null || (context.paymentSkipped && Number(context.incomeStatementId) > 0);
}
