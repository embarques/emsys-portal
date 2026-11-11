"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useAccountingQueryEnabled } from "@/lib/accounting/daily-income/hooks";
import { fetchDailyIncomeJournals } from "./api";
import { queryKeys } from "@/lib/query/query-keys";
import type { DailyIncomeJournalListParams } from "./types";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { createRandomId } from "@/lib/utils/id";

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

/** Bank transactions reconcile only through clearance, so cleared IDs are reconciled right after. */
export function useClearJournals() {
  const client = useQueryClient();
  const {companyId, hasPermission} = useAuth();
  const canReconcile = hasPermission(PERMISSIONS.journalsReconcile.name, PERMISSIONS.journalsReconcile.resourceType);
  return useMutation({
    mutationFn: async ({reconcileIds = [], ...command}: {requestId: string; ids: string[]; reconcileIds?: string[]}) => {
      const response = await clearJournals(command);
      const ids = response.data.cleared.filter(id => reconcileIds.includes(id));
      if (!canReconcile || ids.length === 0) return {...response, reconciliationPending: ids};
      try {
        const reconciled = await reconcileJournals({requestId: createRandomId(), ids});
        return {...response, reconciliationPending: ids.filter(id => !reconciled.data.reconciled.includes(id))};
      } catch {
        return {...response, reconciliationPending: ids};
      }
    },
    retry: false,
    onSuccess: (_result, command) => client.invalidateQueries({predicate: query =>
      query.queryKey[0] === "accounting" &&
      ((["journals", "journal-summary", "outstanding-journal-count"].includes(String(query.queryKey[1])) &&
        query.queryKey.includes(companyId)) ||
       (query.queryKey[1] === "journal" && command.ids.includes(String(query.queryKey[2])))),
    }),
  });
}
