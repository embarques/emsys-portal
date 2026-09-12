import type { LoanStatus, LoanTransactionType } from "@/lib/accounting/loans/types";

export function formatLoanMoney(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
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

export function loanStatusLabel(status: LoanStatus) {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "PAID":
      return "Paid";
    case "VOID":
      return "Void";
    default:
      return status;
  }
}

export function loanTransactionTypeLabel(type: LoanTransactionType) {
  switch (type) {
    case "ISSUE":
      return "Loan issued";
    case "PAYMENT":
      return "Payment";
    default:
      return type;
  }
}
