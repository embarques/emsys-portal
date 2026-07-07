"use client";

import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import {
  createDailyIncomeJournal,
  createIncomeStatement,
  deleteDailyIncomeJournal,
  fetchAccountingPaymentMethods,
  fetchDailyIncomeJournal,
  fetchDailyIncomeJournals,
  fetchDailyIncomeInvoiceRegistration,
  fetchIncomeStatement,
  fetchIncomeStatementById,
  fetchIncomeStatementSummaryTotals,
  setIncomeStatementStatus,
  updateDailyIncomeJournal,
  updateIncomeStatement,
} from "@/lib/accounting/daily-income/api";
import type {
  DailyIncomeJournalListParams,
  DailyIncomeJournalValues,
  DailyIncomeStatement,
  DailyIncomeStatementValues,
} from "@/lib/accounting/daily-income/types";
import { queryKeys } from "@/lib/query/query-keys";
import { useAppSelector } from "@/lib/store/hooks";

/** EMSYS API returns 403 when Authorization or x-company-id are not ready yet. */
function useAccountingQueryEnabled(extraEnabled = true) {
  const { loading, companyId, roleLoading } = useAuth();
  const { idToken, companyId: transportCompanyId } = useAppSelector((state) => state.auth);

  return (
    extraEnabled &&
    !loading &&
    !roleLoading &&
    Boolean(idToken && companyId && transportCompanyId && companyId === transportCompanyId)
  );
}

export function useIncomeStatement(branchId: number, date: string) {
  const queryEnabled = useAccountingQueryEnabled(branchId > 0 && Boolean(date));

  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.incomeStatement(String(branchId), date),
    queryFn: () => fetchIncomeStatement(branchId, date),
    enabled: queryEnabled,
  });
}

export function useIncomeStatementById(incomeStatementId: number | null) {
  const queryEnabled = useAccountingQueryEnabled(Boolean(incomeStatementId));

  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.incomeStatementById(incomeStatementId ?? 0),
    queryFn: () => fetchIncomeStatementById(incomeStatementId ?? 0),
    enabled: queryEnabled,
  });
}

export function useDailyIncomeJournal(journalId: string | null) {
  const queryEnabled = useAccountingQueryEnabled(Boolean(journalId));

  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.journalById(journalId ?? ""),
    queryFn: () => fetchDailyIncomeJournal(journalId ?? ""),
    enabled: queryEnabled,
  });
}

export function useIncomeStatementSummaryTotals(incomeStatementId: number) {
  const queryEnabled = useAccountingQueryEnabled(incomeStatementId > 0);

  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.summaryTotals(incomeStatementId),
    queryFn: () => fetchIncomeStatementSummaryTotals(incomeStatementId),
    enabled: queryEnabled,
  });
}

export function useDailyIncomeJournals(params: DailyIncomeJournalListParams) {
  const queryEnabled = useAccountingQueryEnabled(params.incomeStatementId > 0);

  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.journals(params),
    queryFn: () => fetchDailyIncomeJournals(params),
    enabled: queryEnabled,
    placeholderData: keepPreviousData,
  });
}

export function useDailyIncomeInvoiceRegistration(
  incomeStatementId: number,
  invoiceNumber: string,
) {
  const normalizedNumber = invoiceNumber.trim();
  const queryEnabled = useAccountingQueryEnabled(
    incomeStatementId > 0 && Boolean(normalizedNumber),
  );

  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.invoiceRegistration(incomeStatementId, normalizedNumber),
    queryFn: () => fetchDailyIncomeInvoiceRegistration(incomeStatementId, normalizedNumber),
    enabled: queryEnabled,
  });
}

export {
  useChartAccounts,
  useCreateChartAccount,
  useDeleteChartAccount,
  useUpdateChartAccount,
} from "@/lib/accounting/chart-accounts/hooks/use-chart-accounts";

export function useAccountingPaymentMethods(enabled = true) {
  const queryEnabled = useAccountingQueryEnabled(enabled);

  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.paymentMethods(),
    queryFn: fetchAccountingPaymentMethods,
    enabled: queryEnabled,
    staleTime: 60_000,
  });
}

function invalidateAccounting(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all });
}

function invalidateDailyIncome(queryClient: ReturnType<typeof useQueryClient>) {
  invalidateAccounting(queryClient);
  return queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
}

export function useCreateIncomeStatement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: DailyIncomeStatementValues) => createIncomeStatement(values),
    onSuccess: () => invalidateAccounting(queryClient),
  });
}

export function useUpdateIncomeStatement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: DailyIncomeStatementValues }) =>
      updateIncomeStatement(id, values),
    onSuccess: () => invalidateAccounting(queryClient),
  });
}

export function useSetIncomeStatementStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ statement, open }: { statement: DailyIncomeStatement; open: boolean }) =>
      setIncomeStatementStatus(statement, open),
    onSuccess: () => invalidateAccounting(queryClient),
  });
}

export function useCreateDailyIncomeJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ statement, values }: { statement: DailyIncomeStatement; values: DailyIncomeJournalValues }) =>
      createDailyIncomeJournal(statement, values),
    onSuccess: () => invalidateDailyIncome(queryClient),
  });
}

export function useUpdateDailyIncomeJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, statement, values }: { id: string; statement: DailyIncomeStatement; values: DailyIncomeJournalValues }) =>
      updateDailyIncomeJournal(id, statement, values),
    onSuccess: () => invalidateDailyIncome(queryClient),
  });
}

export function useDeleteDailyIncomeJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteDailyIncomeJournal(id),
    onSuccess: () => invalidateDailyIncome(queryClient),
  });
}
