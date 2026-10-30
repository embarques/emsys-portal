import { pendingTransactionSearch } from "./search";
export { PENDING_TRANSACTION_FILTER_FIELDS } from "./search";
import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { PaginatedApiEnvelope } from "@/lib/api/types";
import { normalizeJournal } from "../daily-income/api";
import type { DailyIncomeJournal } from "../daily-income/types";
import type { JournalTotals } from "../daily-income/journal-classification";
import type { TableFilterRowState } from "@/lib/table/filter-types";

export type PendingJournalPage = { items: DailyIncomeJournal[]; total: number };
export async function fetchPendingTransactions(query: string, rows: TableFilterRowState[], page: number, signal?: AbortSignal): Promise<PendingJournalPage> {
  const result = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(`${API_ENDPOINTS.ACCOUNTING_JOURNALS}/search`, pendingTransactionSearch(query, rows, page), { signal });
  if (result.success === false) throw new Error(result.message || "Journal search failed");
  return { items: (result.data ?? []).map(normalizeJournal).filter((row): row is DailyIncomeJournal => row !== null), total: result.total ?? 0 };
}
export async function fetchSelectedSummary(ids: string[], signal?: AbortSignal) {
  const result = await apiClient.post<PaginatedApiEnvelope<JournalTotals[]>>(`${API_ENDPOINTS.ACCOUNTING_JOURNALS}/summary`, { ids }, { signal });
  if (result.success === false || !Array.isArray(result.data)) throw new Error(result.message || "Journal summary unavailable");
  if (result.data.some(total => ![total.income, total.expenses, total.net, total.count].every(Number.isFinite)) || result.data.reduce((count, total) => count + total.count, 0) !== ids.length) throw new Error("Incomplete journal summary");
  return result.data;
}
export async function reconcileTransactions(ids: string[], requestId: string) {
  const result = await apiClient.post<PaginatedApiEnvelope<{ reconciled: string[]; reconciledAt: string }>>(`${API_ENDPOINTS.ACCOUNTING_JOURNALS}/reconcile`, { ids, requestId });
  if (result.success === false || !Array.isArray(result.data?.reconciled) || ids.some(id => !result.data!.reconciled.includes(id))) throw new Error(result.message || "Reconciliation was not confirmed");
  return result.data;
}
