import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { PaginatedApiEnvelope } from "@/lib/api/types";
import { inventoryIfMatchHeaders } from "@/lib/inventory/api/inventory-api";
import type { InventoryConfirmationParty } from "@/lib/inventory/types/common";
import { confirmationIdempotencyKey, readConfirmationState } from "@/lib/inventory/utils/confirmations";
import {
  RECONCILIATION_STATUSES,
  type DispatchReconciliation,
  type DispatchReconciliationInput,
  type PendingDispatchFilters,
  type PendingDispatchLine,
  type PendingInventoryDispatch,
  type ReconciliationStatus,
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

function count(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeLine(line: PendingDispatchLine): PendingDispatchLine {
  return { ...line, awaitingConfirmationQuantity: count(line.awaitingConfirmationQuantity) };
}

function normalizeRow(row: PendingInventoryDispatch): PendingInventoryDispatch {
  return {
    ...row,
    incomeRecipients: Array.isArray(row.incomeRecipients) ? row.incomeRecipients : [],
    salesRecordedAtDispatch: row.salesRecordedAtDispatch === true,
    awaitingConfirmationQuantity: count(row.awaitingConfirmationQuantity),
    pendingReconciliationCount: count(row.pendingReconciliationCount),
    lines: (row.lines ?? []).map(normalizeLine),
  };
}

export async function fetchPendingDispatches(filters: PendingDispatchFilters, page: number, signal?: AbortSignal) {
  const result = await apiClient.post<PaginatedApiEnvelope<PendingInventoryDispatch[]>>(
    `${API_ENDPOINTS.INVENTORY_PENDING_DISPATCHES}/search`,
    buildPendingDispatchSearch(filters, page),
    { signal },
  );
  return {
    items: (result.data ?? []).map(normalizeRow),
    total: result.total ?? 0,
  };
}

function reconciliationsPath(dispatchId: string) {
  return `${API_ENDPOINTS.INVENTORY_DISPATCHES}/${encodeURIComponent(dispatchId)}/reconciliations`;
}

function readStatus(value: unknown): ReconciliationStatus {
  return (RECONCILIATION_STATUSES as readonly unknown[]).includes(value) ? (value as ReconciliationStatus) : "CONFIRMED";
}

function readVersion(value: unknown): number | null {
  const parsed = Number(value);
  return value != null && value !== "" && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

/** Entries recorded before confirmations existed have no status; they were applied immediately. */
function normalizeReconciliation(entry: DispatchReconciliation): DispatchReconciliation {
  const raw = entry as unknown as Record<string, unknown>;
  return {
    ...entry,
    ...readConfirmationState(raw),
    status: readStatus(raw.status),
    version: readVersion(raw.version),
    lines: entry.lines ?? [],
    payments: Array.isArray(entry.payments) ? entry.payments : [],
    creditMinor: count(raw.creditMinor),
  };
}

export async function fetchDispatchReconciliations(dispatchId: string, signal?: AbortSignal) {
  const result = await apiClient.get<PaginatedApiEnvelope<DispatchReconciliation[]>>(reconciliationsPath(dispatchId), { signal });
  return (result.data ?? []).map(normalizeReconciliation);
}

/** The request id doubles as the idempotency key so a retried submit cannot reconcile twice. */
export function reconcileDispatch(dispatchId: string, input: DispatchReconciliationInput) {
  return apiClient.post(reconciliationsPath(dispatchId), input, { headers: { "Idempotency-Key": input.requestId } });
}

export type ReconciliationConfirmationCommand = {
  dispatchId: string;
  reconciliation: Pick<DispatchReconciliation, "id" | "version">;
  party: InventoryConfirmationParty;
  /** Confirmation notes, or the rejection reason. */
  text: string;
};

function reconciliationCommandPath({ dispatchId, reconciliation }: ReconciliationConfirmationCommand, action: "confirm" | "reject") {
  return `${reconciliationsPath(dispatchId)}/${encodeURIComponent(reconciliation.id)}/${action}`;
}

/** The second party's confirmation applies stock, dispositions, the sale and income. */
export function confirmReconciliation(command: ReconciliationConfirmationCommand) {
  const { reconciliation, party, text } = command;
  return apiClient.post(reconciliationCommandPath(command, "confirm"), { party, notes: text.trim() }, {
    headers: {
      ...inventoryIfMatchHeaders(reconciliation.version),
      "Idempotency-Key": confirmationIdempotencyKey("reconciliation", reconciliation.id, reconciliation.version, party),
    },
  });
}

export function rejectReconciliation(command: ReconciliationConfirmationCommand) {
  const { reconciliation, party, text } = command;
  return apiClient.post(reconciliationCommandPath(command, "reject"), { party, reason: text.trim() }, {
    headers: inventoryIfMatchHeaders(reconciliation.version),
  });
}
