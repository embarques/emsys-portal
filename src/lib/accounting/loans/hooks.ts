"use client";

import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createLoan,
  fetchLoan,
  fetchLoans,
  fetchLoanTransactions,
  recordLoanPayment,
} from "@/lib/accounting/loans/api";
import type { LoanCreateValues, LoanListParams, LoanPaymentValues } from "@/lib/accounting/loans/types";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

export function useLoans(params: LoanListParams) {
  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.loans(params),
    queryFn: () => fetchLoans(params),
    placeholderData: keepPreviousData,
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

export function useRecordLoanPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: LoanPaymentValues) => recordLoanPayment(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all }),
  });
}
