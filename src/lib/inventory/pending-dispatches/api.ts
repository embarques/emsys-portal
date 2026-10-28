import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { PaginatedApiEnvelope } from "@/lib/api/types";
import type {
  DispatchReconciliation,
  DispatchReconciliationInput,
  PendingDispatchFilters,
  PendingInventoryDispatch,
} from "./types";

export const PENDING_DISPATCHES_PAGE_SIZE = 40;

export function buildPendingDispatchSearch(filters: PendingDispatchFilters, page: number) {
  const conditions: { field: string; operator: string; value: string | number }[] = [];
  if (filters.holder) conditions.push({ field: "holder.id", operator: "eq", value: filters.holder });
  if (filters.from) conditions.push({ field: "dispatchedAt", operator: "gte", value: `${filters.from}T00:00:00Z` });
  if (filters.through) conditions.push({ field: "dispatchedAt", operator: "lte", value: `${filters.through}T23:59:59.999Z` });
  if (filters.age !== "" && Number.isFinite(Number(filters.age))) {
    conditions.push({ field: "ageDays", operator: "gte", value: Number(filters.age) });
  }
  return {
    filters: conditions,
    pagination: { page, limit: PENDING_DISPATCHES_PAGE_SIZE },
    // Oldest first: the longest-outstanding custody needs attention first.
    sort: [{ field: "dispatchedAt", direction: "asc" }],
  };
}

export async function fetchPendingDispatches(filters: PendingDispatchFilters, page: number, signal?: AbortSignal) {
  const result = await apiClient.post<PaginatedApiEnvelope<PendingInventoryDispatch[]>>(
    `${API_ENDPOINTS.INVENTORY_PENDING_DISPATCHES}/search`,
    buildPendingDispatchSearch(filters, page),
    { signal },
  );
  return {
    items: (result.data ?? []).map((row) => ({ ...row, lines: row.lines ?? [] })),
    total: result.total ?? 0,
  };
}

function reconciliationsPath(dispatchId: string) {
  return `${API_ENDPOINTS.INVENTORY_DISPATCHES}/${encodeURIComponent(dispatchId)}/reconciliations`;
}

export async function fetchDispatchReconciliations(dispatchId: string, signal?: AbortSignal) {
  const result = await apiClient.get<PaginatedApiEnvelope<DispatchReconciliation[]>>(reconciliationsPath(dispatchId), { signal });
  return (result.data ?? []).map((entry) => ({ ...entry, lines: entry.lines ?? [] }));
}

/** The request id doubles as the idempotency key so a retried submit cannot reconcile twice. */
export function reconcileDispatch(dispatchId: string, input: DispatchReconciliationInput) {
  return apiClient.post(reconciliationsPath(dispatchId), input, { headers: { "Idempotency-Key": input.requestId } });
}
