"use client";

import type { JournalWriteOptions } from "./duplicate-payment";

import { keepPreviousData, useMutation, useMutationState, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import {
  createDailyIncomeJournal,
  createIncomeStatement,
  fetchAccountingPaymentMethods,
  fetchDailyIncomeJournal,
  fetchDailyIncomeJournals,
  fetchDailyIncomeInvoiceRegistration,
  fetchIncomeStatement,fetchCurrentIncomeStatement, fetchCloseoutCalendar,
  fetchOpenIncomeStatements,
  fetchIncomeStatementById,
  fetchIncomeStatementSummaryTotals,
  updateDailyIncomeJournal,
} from "@/lib/accounting/daily-income/api";
import type {
  DailyIncomeJournal,
  DailyIncomeJournalListParams,
  DailyIncomeJournalValues,
  DailyIncomeStatement,
  DailyIncomeStatementValues,
} from "@/lib/accounting/daily-income/types";
import { clearJournals, fetchIncomeStatementJournalCount, reconcileJournals } from "@/lib/accounting/daily-income/reconciliation-api";
import { createJournalWithClearance } from "./create-journal-with-clearance";
import { getAutoClearPermission, getPaymentClearancePermission } from "./auto-clear";
import { queryKeys } from "@/lib/query/query-keys";
import { useAppSelector } from "@/lib/store/hooks";
import { useCurrentUser } from "@/lib/users/hooks/use-users";

/** EMSYS API returns 403 when Authorization or x-company-id are not ready yet. */
export function useAccountingQueryEnabled(extraEnabled = true) {
  const { loading, companyId, roleLoading } = useAuth();
  const { idToken, companyId: transportCompanyId } = useAppSelector((state) => state.auth);

  return (
    extraEnabled &&
    !loading &&
    !roleLoading &&
    Boolean(idToken && companyId && transportCompanyId && companyId === transportCompanyId)
  );
}

export function useOpenIncomeStatements(branchId: number, page: number) {
  const enabled = useAccountingQueryEnabled(branchId > 0);
  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.openIncomeStatements(branchId, page),
    queryFn: () => fetchOpenIncomeStatements(branchId, page),
    enabled,
  });
}

export function useIncomeStatement(branchId: number, date: string) {
  const queryEnabled = useAccountingQueryEnabled(branchId > 0 && Boolean(date));

  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.incomeStatement(String(branchId), date),
    refetchInterval: 30000,
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
  invoiceNumber: string,
) {
  const normalizedNumber = invoiceNumber.trim();
  const queryEnabled = useAccountingQueryEnabled(Boolean(normalizedNumber));

  return useWorkspaceQuery({
    queryKey: queryKeys.accounting.invoiceRegistration(normalizedNumber),
    queryFn: () => fetchDailyIncomeInvoiceRegistration(normalizedNumber),
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
  queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
  return queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
}

export function useCreateIncomeStatement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: DailyIncomeStatementValues) => createIncomeStatement(values),
    onSuccess: () => invalidateAccounting(queryClient),
  });
}

export function useCreateDailyIncomeJournal(sessionId?: string) {
  const queryClient = useQueryClient();
  const { companyId, user, hasPermission } = useAuth();
  const clearancePermission = getPaymentClearancePermission();
  const reconciliationPermission = getAutoClearPermission();
  return useMutation({
    mutationKey: ["daily-income-created", companyId, user?.uid, ...(sessionId ? [sessionId] : [])],
    gcTime: Infinity,
    mutationFn: ({ statement, values, options }: { statement: DailyIncomeStatement; values: DailyIncomeJournalValues; options?: JournalWriteOptions }) =>
      createJournalWithClearance({ statement, values, options }, {
        canClear: hasPermission(clearancePermission.name, clearancePermission.resourceType),
        canReconcile: hasPermission(reconciliationPermission.name, reconciliationPermission.resourceType),
        create: (input) => createDailyIncomeJournal(input.statement, input.values, input.options),
        clear: clearJournals,
        reconcile: reconcileJournals,
        newRequestId: () => crypto.randomUUID(),
      }),
    retry: false,
    onSuccess: () => invalidateDailyIncome(queryClient),
  });
}

export function useUpdateDailyIncomeJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, statement, values, options }: { id: string; statement: DailyIncomeStatement; values: DailyIncomeJournalValues; options?: JournalWriteOptions }) =>
      updateDailyIncomeJournal(id, statement, values, options),
    retry: false,
    onSuccess: () => invalidateDailyIncome(queryClient),
  });
}

/** Successful entries from this signed-in session only; server data stays in TanStack Query. */
export function useSessionDailyIncomeTransactions(statementId: number, sessionId?: string) {
  const { companyId, user } = useAuth();
  return useMutationState({
    filters: { mutationKey: ["daily-income-created", companyId, user?.uid, ...(sessionId ? [sessionId] : [])], status: "success", exact: true },
    select: (mutation) => {
      const variables = mutation.state.variables as { statement: DailyIncomeStatement; values: DailyIncomeJournalValues };
      const journal = mutation.state.data as DailyIncomeJournal;
      return { journal, values: variables.values, statementId: journal?.incomeStatementId || variables.statement.id, savedAt: mutation.state.submittedAt };
    },
  }).filter((entry) => companyId && user?.uid && entry.journal && entry.statementId === statementId).sort((a, b) => b.savedAt - a.savedAt);
}

export function useCurrentIncomeStatement(branchId:number){const {companyId,hasPermission}=useAuth();const enabled=useAccountingQueryEnabled(branchId>0 && hasPermission("canViewIncomeStatement", "income_statement"));return useWorkspaceQuery({queryKey:[...queryKeys.accounting.all,"current-closeout",companyId,branchId],queryFn:({signal})=>fetchCurrentIncomeStatement(branchId,signal),enabled,refetchInterval:30000});}

/** Journals on the user's branch current closeout (what Daily Income opens to). */
export function useCurrentCloseoutTransactionCount(active = true) {
  const { companyId, hasPermission } = useAuth();
  const currentUser = useCurrentUser();
  const branchId = currentUser.data?.branch?.id ?? 0;
  const canView = hasPermission("canViewIncomeStatement", "income_statement") && hasPermission("canViewJournal", "journal");
  const statementEnabled = useAccountingQueryEnabled(active && canView && branchId > 0);
  const statementQuery = useWorkspaceQuery({
    queryKey: [...queryKeys.accounting.all, "current-closeout", companyId, branchId],
    queryFn: ({ signal }) => fetchCurrentIncomeStatement(branchId, signal),
    enabled: statementEnabled,
    staleTime: 30_000,
  });
  const statementId = statementQuery.data?.id ?? 0;
  const countQuery = useWorkspaceQuery({
    queryKey: [...queryKeys.accounting.all, "closeout-journal-count", companyId, statementId],
    queryFn: ({ signal }) => fetchIncomeStatementJournalCount(statementId, signal),
    enabled: statementEnabled && statementId > 0,
    staleTime: 30_000,
  });
  return active && statementId > 0 ? countQuery.data ?? 0 : 0;
}

export function useCloseoutCalendar(branchId: number) {
 const {companyId,user,hasPermission} = useAuth();
 const enabled = useAccountingQueryEnabled(branchId > 0 && hasPermission("canViewIncomeStatement", "income_statement"));
 return useWorkspaceQuery({queryKey:[...queryKeys.accounting.all,"closeout-calendar",companyId,user?.uid,branchId],queryFn:({signal})=>fetchCloseoutCalendar(branchId,signal),enabled,refetchInterval:30000});
}
