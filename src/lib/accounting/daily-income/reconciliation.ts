"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useAccountingQueryEnabled } from "@/lib/accounting/daily-income/hooks";
import { fetchDailyIncomeJournals } from "./api";
import { queryKeys } from "@/lib/query/query-keys";
import type { DailyIncomeJournalListParams } from "./types";

import {clearJournals, fetchJournalSummary, reconcileJournals, type JournalSummaryInput} from "./reconciliation-api";
export type {JournalCurrencySummary} from "./reconciliation-api";
export function useJournalRows(params: DailyIncomeJournalListParams) {
  const {companyId, user, email, roleId, hasPermission} = useAuth();
  const enabled = useAccountingQueryEnabled() && hasPermission("canViewJournal", "journal");
  return useWorkspaceQuery({
    queryKey: [...queryKeys.accounting.journals(params), companyId,user?.uid??email,roleId],
    queryFn: ({signal}) => fetchDailyIncomeJournals(params, signal),
    enabled,
  });
}
export function useJournalSummary(input: JournalSummaryInput, active = true) {
  const {companyId, user, email, roleId, hasPermission} = useAuth();
  const enabled = useAccountingQueryEnabled(active) && hasPermission("canViewJournal", "journal");
  return useWorkspaceQuery({
    queryKey: [...queryKeys.accounting.all, "journal-summary", companyId, user?.uid??email,roleId,input],
    queryFn: ({signal}) => fetchJournalSummary(input, signal), enabled,
  });
}
export function useReconcileJournals() {
  const client = useQueryClient();
  return useMutation({mutationFn: reconcileJournals, retry: false,
    onSuccess: () => client.invalidateQueries({queryKey: queryKeys.accounting.all})});
}

/** Clearance atomically reconciles and applies any deferred invoice receipt. */
export function useClearJournals() {
  const client = useQueryClient();
  const {companyId} = useAuth();
  return useMutation({
    mutationFn: ({requestId, ids}: {requestId: string; ids: string[]; invoices?: {id: string; number?: string}[]; incomeStatementIds?: number[]}) => clearJournals({requestId, ids}),
    retry: false,
    onSuccess: (_result, command) => Promise.all([
      client.invalidateQueries({predicate: query =>
      query.queryKey[0] === "accounting" &&
      ((["journals", "journal-summary", "outstanding-journal-count"].includes(String(query.queryKey[1])) &&
        query.queryKey.includes(companyId)) ||
       (query.queryKey[1] === "journal" && command.ids.includes(String(query.queryKey[2])))),
      }),
      ...(command.invoices?.length ? [
        client.invalidateQueries({queryKey: queryKeys.invoices.lists()}),
        client.invalidateQueries({queryKey: queryKeys.invoices.stats("outstanding")}),
        client.invalidateQueries({queryKey: queryKeys.invoices.stats("outstanding-balance")}),
        ...command.invoices.flatMap(invoice => [
          client.invalidateQueries({queryKey: queryKeys.invoices.detail(invoice.id)}),
          client.invalidateQueries({queryKey: queryKeys.invoices.journals(invoice.id, invoice.number)}),
        ]),
        client.invalidateQueries({predicate: query => query.queryKey[0] === "delivery-balance" && query.queryKey[1] === companyId && command.invoices!.some(invoice => invoice.id === query.queryKey[3])}),
      ] : []),
      ...(command.incomeStatementIds ?? []).flatMap(id => [
        client.invalidateQueries({queryKey: queryKeys.accounting.summaryTotals(id)}),
        client.invalidateQueries({queryKey: queryKeys.accounting.incomeStatementById(id)}),
      ]),
    ]),
  });
}
