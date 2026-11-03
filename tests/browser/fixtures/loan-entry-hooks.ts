import { useMutation } from "@tanstack/react-query";
import type { Loan, LoanCreateValues, LoanPaymentValues } from "@/lib/accounting/loans/types";

declare global {
  interface Window {
    loanEntryRequests?: Array<{ kind: string; values: LoanCreateValues | LoanPaymentValues }>;
    loanEntryFailure?: boolean;
  }
}
export function useAuth() { return { companyId: "company", user: { uid: "poster" }, hasPermission: () => true }; }
export const store = { getState: () => ({ auth: { companyId: "company" } }) };
export function useFeedback() { return { notifySuccess: () => {}, notifyError: () => {} }; }
export function normalizeApiError(error: Error) { return { message: error.message }; }
export function useCurrentIncomeStatement(branchId: number) {
  return { data: branchId ? { id: 1, status: "OPEN", businessDate: "2026-11-03" } : null, isFetching: false, isError: false, refetch: async () => {} };
}
export function useCreateLoan() {
  return useMutation({ mutationFn: async (values: LoanCreateValues) => {
    (window.loanEntryRequests ??= []).push({ kind: "issue", values });
    return null;
  } });
}
export function useRecordLoanPayment() {
  return useMutation({ mutationFn: async (values: LoanPaymentValues) => {
    (window.loanEntryRequests ??= []).push({ kind: "payment", values });
    if (window.loanEntryFailure) { window.loanEntryFailure = false; throw new Error("Payment could not be saved"); }
    return null;
  } });
}
export function useEmployeeActiveLoans(employeeId: number) {
  const loan = { id: "loan-1", employee: { id: 1, name: "Ana" }, balance: 250, principalAmount: 250,
    paidAmount: 0, status: "ACTIVE", openedAt: "2026-11-01", createdAt: "2026-11-01", description: "Employee loan", referenceNumber: "", loanAccount: { id: 2, name: "Employee loans" } } as Loan;
  return { data: { items: employeeId ? [loan] : [], total: employeeId ? 1 : 0 }, isSuccess: true, isFetching: false, isError: false };
}
