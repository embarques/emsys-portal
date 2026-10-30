"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useAccountingQueryEnabled } from "@/lib/accounting/daily-income/hooks";
import { fetchDailyIncomeJournals } from "./api";
import { queryKeys } from "@/lib/query/query-keys";
import type { DailyIncomeJournalListParams } from "./types";

import {fetchJournalSummary, reconcileJournals, type JournalSummaryInput} from "./reconciliation-api";
export type {JournalCurrencySummary} from "./reconciliation-api";
export function useJournalRows(params: DailyIncomeJournalListParams) {
  const {companyId, hasPermission} = useAuth();
  const enabled = useAccountingQueryEnabled() && hasPermission("canViewJournal", "journal");
  return useWorkspaceQuery({
    queryKey: [...queryKeys.accounting.journals(params), companyId],
    queryFn: ({signal}) => fetchDailyIncomeJournals(params, signal),
    enabled,
  });
}
export function useJournalSummary(input: JournalSummaryInput, active = true) {
  const {companyId, hasPermission} = useAuth();
  const enabled = useAccountingQueryEnabled(active) && hasPermission("canViewJournal", "journal");
  return useWorkspaceQuery({
    queryKey: [...queryKeys.accounting.all, "journal-summary", companyId, input],
    queryFn: ({signal}) => fetchJournalSummary(input, signal), enabled,
  });
}
export function useReconcileJournals() {
  const client = useQueryClient();
  return useMutation({mutationFn: reconcileJournals, retry: false,
    onSuccess: () => client.invalidateQueries({queryKey: queryKeys.accounting.all})});
}
