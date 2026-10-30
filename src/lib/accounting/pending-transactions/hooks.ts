"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useAccountingQueryEnabled } from "@/lib/accounting/daily-income/hooks";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { toApiPaymentMethodName } from "../daily-income/types";
import type { TableFilterRowState } from "@/lib/table/filter-types";
import { fetchPendingTransactions, fetchSelectedSummary, reconcileTransactions, type PendingJournalPage } from "./api";

export function usePendingTransactions() {
  const { companyId, hasPermission } = useAuth();
  const ready = useAccountingQueryEnabled();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<TableFilterRowState[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const submitting = useRef(false);
  const searchInput = useMemo(() => ({ query, filters }), [query, filters]);
  const deferred = useDebouncedValue(searchInput, 300);
  // Existing Pending Transactions grant remains the explicit legacy list fallback.
  const canView = hasPermission("canListJournal", "journal") || hasPermission("canViewFinancialActivity", "financial_activity");
  const canReconcile = hasPermission("canReconcileJournal", "journal");
  const prefix = ["accounting", "pending-journals", companyId] as const;
  const list = useWorkspaceQuery({
    queryKey: [...prefix, deferred, page],
    queryFn: ({ signal }) => fetchPendingTransactions(deferred.query, deferred.filters, page, signal),
    enabled: ready && canView,
    gcTime: 30 * 60 * 1000,
  });
  const cached = client.getQueriesData<PendingJournalPage>({ queryKey: prefix });
  const byId = new Map(cached.flatMap(([, data]) => (data?.items ?? []).map(row => [row.id, row] as const)));
  for (const row of list.data?.items ?? []) byId.set(row.id, row);
  const selectedRows = selectedIds.flatMap(id => { const row = byId.get(id); return row ? [row] : []; });
  const selectionKey = useMemo(() => [...selectedIds].sort(), [selectedIds]);
  const summary = useWorkspaceQuery({
    queryKey: ["accounting", "pending-journal-summary", companyId, selectionKey],
    queryFn: ({ signal }) => fetchSelectedSummary(selectionKey, signal),
    enabled: ready && canView && selectionKey.length > 0,
    staleTime: 0,
  });
  const selectionMethod = toApiPaymentMethodName(selectedRows[0]?.paymentMethod?.name);
  const validSelection = selectedRows.length === selectedIds.length && selectedRows.every(row => toApiPaymentMethodName(row.paymentMethod?.name) === selectionMethod);
  function select(ids: string[], checked: boolean) {
    if (submitting.current) return;
    const next = checked ? [...new Set([...selectedIds, ...ids])].slice(0, 200) : selectedIds.filter(id => !ids.includes(id));
    const method = selectedRows[0]?.paymentMethod?.name ?? byId.get(next[0])?.paymentMethod?.name;
    const sameMethod = next.filter(id => toApiPaymentMethodName(byId.get(id)?.paymentMethod?.name) === toApiPaymentMethodName(method));
    setSelectedIds(sameMethod);
    setRequestId(crypto.randomUUID());
  }
  function clearSelection() { if (!submitting.current) { setSelectedIds([]); setRequestId(crypto.randomUUID()); } }
  const reconcile = useMutation({
    mutationFn: async () => {
      if (!ready || !canView || !canReconcile || !validSelection || !selectedIds.length || submitting.current) throw new Error("Invalid reconciliation selection");
      submitting.current = true;
      try { return await reconcileTransactions(selectionKey, requestId); }
      finally { submitting.current = false; }
    },
    onSuccess: async () => {
      setSelectedIds([]);
      setRequestId(crypto.randomUUID());
      await Promise.all([
        client.invalidateQueries({ queryKey: prefix }),
        client.invalidateQueries({ queryKey: ["accounting", "pending-journal-summary", companyId] }),
        client.invalidateQueries({ queryKey: ["accounting", "journals"] }),
        client.invalidateQueries({ queryKey: ["accounting", "financial-activity", companyId] }),
      ]);
    },
  });
  return { page, setPage, query, setQuery: (value: string) => { setQuery(value); setPage(1); }, filters,
    setFilters: (value: TableFilterRowState[]) => { setFilters(value); setPage(1); },
    canView, canReconcile, list, selectedIds, selectedRows, summary, select, clearSelection, reconcile, validSelection };
}
