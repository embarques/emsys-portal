"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { store } from "@/lib/store/store";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { createLoanDecreaseSession } from "./loan-decrease-session";
import { createLoanIncreaseSession } from "./loan-increase-session";

import {
  createLoan,
  fetchLoan,
  fetchLoans,
  fetchLoanTransactions,
  recordLoanPayment,
} from "@/lib/accounting/loans/api";
import type { LoanCreateValues, LoanDecreaseValues, LoanIncreaseValues, LoanListParams, LoanPaymentValues } from "@/lib/accounting/loans/types";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

export function useLoans(params: LoanListParams) {
  const { companyId, user, roleId, hasPermission } = useAuth();
  return useWorkspaceQuery({
    queryKey: [...queryKeys.accounting.loans(params), companyId, user?.uid, roleId],
    queryFn: () => fetchLoans(params),
    enabled: Boolean(companyId && hasPermission("canViewJournal", "journal")),
    placeholderData: (previous, query) => query?.queryKey[3] === companyId && query?.queryKey[4] === user?.uid && query?.queryKey[5] === roleId ? previous : undefined,
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
  const { companyId, user, roleId, hasPermission } = useAuth();
  const params = employeeActiveLoansParams(employeeId);
  return useWorkspaceQuery({
    queryKey: [...queryKeys.accounting.loans(params), companyId, user?.uid, roleId],
    queryFn: () => fetchLoans(params),
    enabled: enabled && employeeId > 0 && Boolean(companyId) && hasPermission("canViewJournal", "journal"),
  });
}

export function useLoan(id: string | null, enabled = true) {
  const { companyId, user, roleId, hasPermission } = useAuth();
  return useWorkspaceQuery({
    queryKey: [...queryKeys.accounting.loan(id ?? ""), companyId, user?.uid, roleId],
    queryFn: () => fetchLoan(id!),
    enabled: enabled && Boolean(id) && Boolean(companyId) && hasPermission("canViewJournal", "journal"),
  });
}

export function useLoanTransactions(id: string | null, enabled = true) {
  const { companyId, user, roleId, hasPermission } = useAuth();
  return useWorkspaceQuery({
    queryKey: [...queryKeys.accounting.loanTransactions(id ?? ""), companyId, user?.uid, roleId],
    queryFn: () => fetchLoanTransactions(id!),
    enabled: enabled && Boolean(id) && Boolean(companyId) && hasPermission("canViewJournal", "journal"),
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
  const { companyId, user } = useAuth();
  const session = useRef<ReturnType<typeof createLoanIncreaseSession> | null>(null);
  if (session.current === null) session.current = createLoanIncreaseSession();
  return useMutation({
    mutationFn: (values: LoanIncreaseValues) => session.current!(JSON.stringify([companyId, user?.uid]), values),
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all }),
  });
}

export function useDecreaseLoan() {
  const queryClient = useQueryClient();
  const { companyId, user } = useAuth();
  const session = useRef<ReturnType<typeof createLoanDecreaseSession> | null>(null);
  if (session.current === null) session.current = createLoanDecreaseSession();
  return useMutation({
    mutationFn: (values: LoanDecreaseValues) => session.current!(JSON.stringify([companyId, user?.uid]), values),
    retry: false,
    onSuccess: (result, values) => {
      if (store.getState().auth.companyId !== companyId) return;
      return Promise.all([
        queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === "accounting" && query.queryKey.includes(companyId) &&
          (["loans", "journals", "journal-summary", "outstanding-journal-count"].includes(String(query.queryKey[1])) ||
           (["loan", "loan-transactions"].includes(String(query.queryKey[1])) && query.queryKey[2] === values.loanId)) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounting.summaryTotals(result.incomeStatementId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.accounting.incomeStatementById(result.incomeStatementId) }),
      ]);
    },
  });
}

export function useRecordLoanPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: LoanPaymentValues) => recordLoanPayment(values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all }),
  });
}
