import { PERMISSIONS } from "@/lib/auth/permissions";
import { requiresBankAccount, type DailyIncomeJournalValues } from "./types";

export function isBankInvoicePayment(values: Pick<DailyIncomeJournalValues, "transactionType" | "paymentMethodName">) {
  return requiresBankAccount(values.paymentMethodName) &&
    (values.transactionType === "PAYMENT" || values.transactionType === "INITIAL-PAYMENT");
}

export function isBankTransaction(values: Pick<DailyIncomeJournalValues, "transactionType" | "paymentMethodName">) {
  return requiresBankAccount(values.paymentMethodName) &&
    ["PAYMENT", "INITIAL-PAYMENT", "SALES", "EXPENSE"].includes(values.transactionType);
}

export function getPaymentClearancePermission() {
  return PERMISSIONS.journalsClear;
}

/** Approval uses the explicit journal grant for every method and transaction type. */
export function getAutoClearPermission() {
  return PERMISSIONS.journalsReconcile;
}

/**
 * Non-bank journals may auto-reconcile on save.
 * Bank journals use clearance (and optional auto-clear) for settlement; they can
 * still be reconciled separately while clearance remains outstanding.
 */
export function isAutoClearEligible(values: Pick<DailyIncomeJournalValues, "transactionType" | "amount" | "paymentMethodName">): boolean {
  return Boolean(values.transactionType) && !isBankTransaction(values);
}
