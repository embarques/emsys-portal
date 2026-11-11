"use client";

import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createLoan,
  fetchLoan,
  fetchLoans,
  fetchLoanTransactions,
  increaseLoan,
  recordLoanPayment,
} from "@/lib/accounting/loans/api";
import type { LoanCreateValues, LoanIncreaseValues, LoanListParams, LoanPaymentValues } from "@/lib/accounting/loans/types";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

export function useLoans(params: LoanListParams) {
  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.loans(params),
    queryFn: () => fetchLoans(params),
    placeholderData: keepPreviousData,
  });
}

const EMPLOYEE_ACTIVE_LOANS_LIMIT = 100;

function employeeActiveLoansParams(employeeId: number): LoanListParams {
  return {
    page: 1,
    limit: EMPLOYEE_ACTIVE_LOANS_LIMIT,
    sort: "openedAt:asc",
    filterRows: [
      { id: "employee.id", join: "and", field: "employee.id", operator: "eq", value: String(employeeId) },
      { id: "status", join: "and", field: "status", operator: "eq", value: "ACTIVE" },
    ],
  };
}

/** Active loans for one employee, oldest first (the order payments are allocated in). */
export function useEmployeeActiveLoans(employeeId: number, enabled = true) {
  const params = employeeActiveLoansParams(employeeId);
  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.loans(params),
    queryFn: () => fetchLoans(params),
    enabled: enabled && employeeId > 0,
  });
}

export function useLoan(id: string | null, enabled = true) {
  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.loan(id ?? ""),
    queryFn: () => fetchLoan(id!),
    enabled: enabled && Boolean(id),
  });
}

export function useLoanTransactions(id: string | null, enabled = true) {
  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.loanTransactions(id ?? ""),
    queryFn: () => fetchLoanTransactions(id!),
    enabled: enabled && Boolean(id),
  });
}

export function useCreateLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: LoanCreateValues) => createLoan(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all }),
  });
}

export function useIncreaseLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: LoanIncreaseValues) => increaseLoan(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all }),
  });
}

export function useRecordLoanPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: LoanPaymentValues) => recordLoanPayment(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all }),
  });
}
