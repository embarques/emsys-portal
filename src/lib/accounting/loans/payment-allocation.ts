import type { Loan } from "./types";

export type LoanPaymentAllocationRow = {
  loan: Loan;
  applied: number;
  balanceAfter: number;
};

export type LoanPaymentAllocation = {
  rows: LoanPaymentAllocationRow[];
  totals: {
    principalAmount: number;
    paidAmount: number;
    balance: number;
    applied: number;
    balanceAfter: number;
  };
  /** Portion of the payment that exceeds the combined balance of the loans. */
  unapplied: number;
};

const toCents = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100);
const fromCents = (cents: number) => cents / 100;

export function sortLoansOldestFirst(loans: Loan[]): Loan[] {
  return [...loans].sort(
    (left, right) =>
      left.openedAt.localeCompare(right.openedAt) || left.createdAt.localeCompare(right.createdAt),
  );
}

/** Applies a payment to the given loans in order, capping each at its current balance. */
export function allocateLoanPayment(loans: Loan[], amount: number): LoanPaymentAllocation {
  let remaining = Math.max(0, toCents(amount));
  const totals = { principalAmount: 0, paidAmount: 0, balance: 0, applied: 0, balanceAfter: 0 };
  const rows = loans.map((loan) => {
    const balance = Math.max(0, toCents(loan.balance));
    const applied = Math.min(balance, remaining);
    remaining -= applied;
    totals.principalAmount += toCents(loan.principalAmount);
    totals.paidAmount += toCents(loan.paidAmount);
    totals.balance += balance;
    totals.applied += applied;
    totals.balanceAfter += balance - applied;
    return { loan, applied: fromCents(applied), balanceAfter: fromCents(balance - applied) };
  });

  return {
    rows,
    totals: {
      principalAmount: fromCents(totals.principalAmount),
      paidAmount: fromCents(totals.paidAmount),
      balance: fromCents(totals.balance),
      applied: fromCents(totals.applied),
      balanceAfter: fromCents(totals.balanceAfter),
    },
    unapplied: fromCents(remaining),
  };
}
