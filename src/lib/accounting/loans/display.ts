import type { TranslateFn } from "@/lib/feedback/messages";
import type { LoanStatus, LoanTransactionType } from "@/lib/accounting/loans/types";

export function formatLoanMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Pill colors for loan balance: paid off / zero = emerald; outstanding = rose. */
export function getLoanBalanceMoneyClass(amount: number): string {
  if (amount <= 0) {
    return "border-transparent bg-emerald-500/15 font-semibold tabular-nums text-emerald-700 dark:text-emerald-300";
  }
  return "border-transparent bg-rose-500/15 font-semibold tabular-nums text-rose-700 dark:text-rose-300";
}

export function formatLoanDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

export function loanStatusLabel(status: LoanStatus, t: TranslateFn) {
  switch (status) {
    case "ACTIVE":
    case "PAID":
    case "VOID":
      return t(`accounting.loans.status.${status}`);
    default:
      return status;
  }
}

export function loanTransactionTypeLabel(type: LoanTransactionType, t: TranslateFn) {
  switch (type) {
    case "ISSUE":
    case "INCREASE":
    case "PAYMENT":
      return t(`accounting.loans.transactionTypes.${type}`);
    default:
      return type;
  }
}
