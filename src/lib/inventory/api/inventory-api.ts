import type { AxiosRequestConfig } from "axios";

import { INVENTORY_DISPATCH_API_TABLE_FIELDS } from "@/lib/inventory/dispatches/table-fields";
import { INVENTORY_RECEIPT_API_TABLE_FIELDS } from "@/lib/inventory/receipts/table-fields";
import { INVENTORY_SUPPLIER_API_TABLE_FIELDS } from "@/lib/inventory/suppliers/table-fields";
import { INVENTORY_ITEM_API_TABLE_FIELDS } from "@/lib/inventory/items/table-fields";
import { captureApiTableFields, readApiUserUsername } from "@/lib/table/api-table-fields";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { runSettledWithConcurrency, type BulkSettledResult } from "@/lib/api/run-settled-with-concurrency";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery } from "@/lib/api/list-query";
import {
  buildResourceSearchFilterGroups,
  buildStripeStyleSearchBody,
  hasResourceListFilters,
  type ApiSearchFilter,
} from "@/lib/api/search-query";
import { resolvePaginatedListTotal, type PaginatedApiEnvelope, type PaginatedResult } from "@/lib/api/types";
import {
  INVENTORY_DISPATCH_BAR_OR_SEARCH_FIELDS,
  INVENTORY_HOLDER_BAR_OR_SEARCH_FIELDS,
  INVENTORY_ITEM_BAR_OR_SEARCH_FIELDS,
  INVENTORY_RECEIPT_BAR_OR_SEARCH_FIELDS,
  INVENTORY_STOCK_BAR_OR_SEARCH_FIELDS,
  INVENTORY_SUPPLIER_BAR_OR_SEARCH_FIELDS,
} from "@/lib/inventory/search-fields";
import {
  buildInventoryAdjustmentPayload,
  buildInventoryDispatchPayload,
  buildInventoryHolderPayload,
  buildInventoryItemPayload,
  buildInventoryReceiptPayload,
  buildInventorySupplierPayload,
  type InventoryPayloadResult,
} from "@/lib/inventory/schemas/inventory.schema";
import type { InventoryFormValues, InventoryItem, InventoryStockBalance } from "@/lib/inventory/types/catalog";
import {
  isInventoryDocumentStatus,
  isInventoryStockCondition,
  type InventoryAuditFields,
} from "@/lib/inventory/types/common";
import type {
  DispatchFormValues,
  InventoryDispatch,
  InventoryReceipt,
  ReceiptFormValues,
} from "@/lib/inventory/types/documents";
import {
  isInventoryHolderType,
  type InventoryHolder,
  type InventoryHolderFormValues,
  type InventoryRouteCrew,
} from "@/lib/inventory/types/holders";
import {
  DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS,
  DEFAULT_INVENTORY_HOLDER_LIST_PARAMS,
  DEFAULT_INVENTORY_ITEM_LIST_PARAMS,
  DEFAULT_INVENTORY_RECEIPT_LIST_PARAMS,
  DEFAULT_INVENTORY_STOCK_LIST_PARAMS,
  DEFAULT_INVENTORY_SUPPLIER_LIST_PARAMS,
  type InventoryListParams,
} from "@/lib/inventory/types/list";
import type { AdjustmentFormValues } from "@/lib/inventory/types/movements";
import type { InventorySupplier, InventorySupplierContact, SupplierFormValues } from "@/lib/inventory/types/suppliers";

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

/** Minimal reference for commands that need the current optimistic-lock version. */
export type InventoryVersionedRef = { id: string; version: number | null };

function readStringId(value: unknown): string | undefined {
  if (value == null) return undefined;
  const id = String(value).trim();
  return id || undefined;
}

function readString(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function readNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readOptionalMinor(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function readVersion(value: unknown): number | null {
  const parsed = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof parsed === "number" && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function readAudit(entry: Record<string, unknown>): InventoryAuditFields {
  const audit = entry.audit && typeof entry.audit === "object" ? (entry.audit as Record<string, unknown>) : {};
  return {
    createdAt: readString(audit.createdAt ?? entry.createdAt),
    createdBy: readApiUserUsername(audit.createdBy ?? entry.createdBy),
    updatedAt: readString(audit.updatedAt ?? entry.updatedAt),
    updatedBy: readApiUserUsername(audit.updatedBy ?? entry.updatedBy),
  };
}

function readLines(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((line): line is Record<string, unknown> => Boolean(line) && typeof line === "object")
    : [];
}

function unwrapRecord(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  if ("data" in payload) {
    return (payload as PaginatedApiEnvelope<unknown>).data;
  }
  return payload;
}

function parseInventoryPathId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) {
    throw new Error("Invalid inventory ID.");
  }
  return encodeURIComponent(trimmed);
}

/** Swagger requires `If-Match` with the current entity version on PATCH, post and cancel. */
export function inventoryIfMatchHeaders(version: number | null): Record<string, string> {
  if (version == null || !Number.isSafeInteger(version) || version < 0) {
    throw new Error("Reload this record to get its current version, then try again.");
  }
  return { "If-Match": String(version) };
}

/**
 * Posting is retried safely with the same key; a new version is a new command.
 * Keys are scoped by document and version so a double-click cannot post twice.
 */
export function inventoryPostHeaders(kind: string, ref: InventoryVersionedRef): Record<string, string> {
  return {
    ...inventoryIfMatchHeaders(ref.version),
    "Idempotency-Key": `inventory-${kind}-post:${ref.id}:v${ref.version}`,
  };
}

function headers(values: Record<string, string>): AxiosRequestConfig {
  return { headers: values };
}

function requirePayload<T>(result: InventoryPayloadResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.payload;
}

function extractCreatedId(response: ApiMutationEnvelope<unknown>): string | null {
  const data = response.data;
  if (typeof data === "string") {
    return data.trim() || null;
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return readStringId((data as { id?: unknown }).id) ?? null;
  }
  return null;
}

function hasInventoryListFilters(params: InventoryListParams): boolean {
  return (
    hasResourceListFilters({ search: params.search }) ||
    Boolean(params.itemId?.trim()) ||
    Boolean(params.supplierId?.trim()) ||
    Boolean(params.holderId?.trim())
  );
}

function buildInventoryListQuery(params: InventoryListParams, fallback: Pick<InventoryListParams, "page" | "limit" | "sort">): string {
  return buildApiListQuery({
    page: params.page ?? fallback.page,
    limit: params.limit ?? fallback.limit,
    offset: params.offset,
    sort: params.sort ?? fallback.sort,
  });
}

function extraInventoryFilters(params: InventoryListParams): ApiSearchFilter[] {
  const filters: ApiSearchFilter[] = [];
  for (const field of ["itemId", "supplierId", "holderId"] as const) {
    const value = params[field]?.trim();
    if (value) filters.push({ field, operator: "eq", value });
  }
  return filters;
}

function buildInventorySearchBody(
  params: InventoryListParams,
  fallbackSort: InventoryListParams["sort"],
  barOrSearchFields: readonly string[],
) {
  const extraFilters = extraInventoryFilters(params);
  return buildStripeStyleSearchBody({
    sort: params.sort ?? fallbackSort,
    filterGroups: [
      ...buildResourceSearchFilterGroups({
        search: params.search,
        barOrSearchFields,
        tableFilterFields: [],
      }),
      ...(extraFilters.length > 0 ? [{ operator: "and" as const, filters: extraFilters }] : []),
    ],
  });
}

function normalizePaginated<T>(
  payload: PaginatedApiEnvelope<unknown[]>,
  normalizeOne: (raw: unknown) => T | null,
  context?: { isFiltered?: boolean },
): PaginatedResult<T> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeOne).filter((item): item is T => item != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: resolvePaginatedListTotal(payload, items.length, context),
  };
}

function asRecord(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

export function normalizeInventoryItem(raw: unknown): InventoryItem | null {
  const entry = asRecord(raw);
  const id = readStringId(entry?.id);
  if (!entry || !id) return null;

  return {
    ...captureApiTableFields(raw, INVENTORY_ITEM_API_TABLE_FIELDS),
    ...readAudit(entry),
    id,
    sku: readString(entry.sku),
    name: readString(entry.name),
    unitOfMeasure: readString(entry.unitOfMeasure),
    category: readString(entry.category),
    defaultSellingPriceMinor: readOptionalMinor(entry.defaultSellingPriceMinor),
    currency: readString(entry.currency) || "USD",
    reorderThreshold: readNumber(entry.reorderThreshold),
    isActive: entry.isActive !== false,
    version: readVersion(entry.version),
  };
}

export function normalizeInventoryStockBalance(raw: unknown): InventoryStockBalance | null {
  const entry = asRecord(raw);
  const itemId = readStringId(entry?.itemId);
  const holderId = readStringId(entry?.holderId);
  if (!entry || !itemId || !holderId) return null;
  const condition = isInventoryStockCondition(entry.condition) ? entry.condition : "AVAILABLE";

  return {
    id: readStringId(entry.id) ?? `${holderId}:${itemId}:${condition}`,
    holderId,
    itemId,
    condition,
    quantityOnHand: readNumber(entry.quantityOnHand),
    quantityReserved: readNumber(entry.quantityReserved),
    updatedAt: readString(entry.updatedAt),
    version: readVersion(entry.version),
  };
}

export function normalizeInventoryHolder(raw: unknown): InventoryHolder | null {
  const entry = asRecord(raw);
  const id = readStringId(entry?.id);
  if (!entry || !id || !isInventoryHolderType(entry.type)) return null;

  return {
    ...readAudit(entry),
    id,
    type: entry.type,
    displayName: readString(entry.displayName) || id,
    entityId: readString(entry.entityId),
    isActive: entry.isActive !== false,
    version: readVersion(entry.version),
  };
}

function readDocumentBase(entry: Record<string, unknown>, id: string) {
  return {
    ...readAudit(entry),
    id,
    status: isInventoryDocumentStatus(entry.status) ? entry.status : "DRAFT",
    notes: readString(entry.notes),
    postedAt: readString(entry.postedAt),
    postedBy: readApiUserUsername(entry.postedBy),
    correctsSourceId: readString(entry.correctsSourceId),
    version: readVersion(entry.version),
  } as const;
}

export function normalizeInventoryReceipt(raw: unknown): InventoryReceipt | null {
  const entry = asRecord(raw);
  const id = readStringId(entry?.id);
  if (!entry || !id) return null;

  return {
    ...captureApiTableFields(raw, INVENTORY_RECEIPT_API_TABLE_FIELDS),
    ...readDocumentBase(entry, id),
    supplierId: readString(entry.supplierId),
    toHolderId: readString(entry.toHolderId),
    receivedAt: readString(entry.receivedAt),
    lines: readLines(entry.lines).map((line) => ({
      ...(readStringId(line.id) ? { id: readStringId(line.id) } : {}),
      itemId: readString(line.itemId),
      quantity: readNumber(line.quantity),
      unitCostMinor: readNumber(line.unitCostMinor),
    })),
  };
}

export function normalizeInventoryDispatch(raw: unknown): InventoryDispatch | null {
  const entry = asRecord(raw);
  const id = readStringId(entry?.id);
  if (!entry || !id) return null;

  return {
    ...captureApiTableFields(raw, INVENTORY_DISPATCH_API_TABLE_FIELDS),
    ...readDocumentBase(entry, id),
    fromHolderId: readString(entry.fromHolderId),
    toHolderId: readString(entry.toHolderId),
    assigneeEmployeeId: readString(entry.assigneeEmployeeId),
    dailyRouteId: readString(entry.dailyRouteId),
    dispatchedAt: readString(entry.dispatchedAt),
    lines: readLines(entry.lines).map((line) => ({
      ...(readStringId(line.id) ? { id: readStringId(line.id) } : {}),
      itemId: readString(line.itemId),
      quantity: readNumber(line.quantity),
    })),
  };
}

function normalizeSupplierContact(raw: Record<string, unknown>): InventorySupplierContact {
  return { name: readString(raw.name), phone: readString(raw.phone), email: readString(raw.email) };
}

export function normalizeInventorySupplier(raw: unknown): InventorySupplier | null {
  const entry = asRecord(raw);
  const id = readStringId(entry?.id);
  if (!entry || !id) return null;

  return {
    ...captureApiTableFields(raw, INVENTORY_SUPPLIER_API_TABLE_FIELDS),
    ...readAudit(entry),
    id,
    companyName: readString(entry.companyName),
    contacts: readLines(entry.contacts).map(normalizeSupplierContact),
    addresses: Array.isArray(entry.addresses) ? entry.addresses.map(readString).filter(Boolean) : [],
    isActive: entry.isActive !== false,
    version: readVersion(entry.version),
  };
}

function normalizeRouteCrew(raw: unknown): InventoryRouteCrew | null {
  const entry = asRecord(raw);
  const id = readStringId(entry?.id);
  if (!entry || !id) return null;
  return { id, name: readString(entry.name) || id, isActive: entry.isActive !== false };
}

async function fetchById<T>(
  endpoint: string,
  id: string,
  normalizeOne: (raw: unknown) => T | null,
  notFoundMessage: string,
): Promise<T> {
  const pathId = parseInventoryPathId(id);
  const response = await apiClient.get<unknown>(`${endpoint}/${pathId}`);
  const entity = normalizeOne(unwrapRecord(response));
  if (!entity) {
    throw new Error(notFoundMessage);
  }
  return entity;
}

async function resolveCreated<T>(
  response: ApiMutationEnvelope<unknown>,
  normalizeOne: (raw: unknown) => T | null,
  fetchOne: (id: string) => Promise<T>,
  fallbackMessage: string,
): Promise<T> {
  const entity = normalizeOne(response.data);
  if (entity) return entity;

  const createdId = extractCreatedId(response);
  if (createdId) return fetchOne(createdId);

  throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
}

async function createRecord<T>(
  endpoint: string,
  payload: unknown,
  normalizeOne: (raw: unknown) => T | null,
  fetchOne: (id: string) => Promise<T>,
  fallbackMessage: string,
): Promise<T> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(endpoint, payload);
  assertMutationSuccess(response, fallbackMessage);
  return resolveCreated(response, normalizeOne, fetchOne, fallbackMessage);
}

async function patchRecord<T>(
  endpoint: string,
  ref: InventoryVersionedRef,
  payload: unknown,
  normalizeOne: (raw: unknown) => T | null,
  fetchOne: (id: string) => Promise<T>,
  fallbackMessage: string,
): Promise<T> {
  const id = parseInventoryPathId(ref.id);
  const response = await apiClient.patch<ApiMutationEnvelope<unknown>>(
    `${endpoint}/${id}`,
    payload,
    headers(inventoryIfMatchHeaders(ref.version)),
  );
  assertMutationSuccess(response, fallbackMessage);
  return normalizeOne(response.data) ?? fetchOne(ref.id);
}

async function runDocumentCommand(
  endpoint: string,
  kind: string,
  action: "post" | "cancel",
  ref: InventoryVersionedRef,
  fallbackMessage: string,
): Promise<void> {
  const id = parseInventoryPathId(ref.id);
  const commandHeaders = action === "post" ? inventoryPostHeaders(kind, ref) : inventoryIfMatchHeaders(ref.version);
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    `${endpoint}/${id}/${action}`,
    undefined,
    headers(commandHeaders),
  );
  assertMutationSuccess(response, fallbackMessage);
}

function listResource<T>(
  endpoint: string,
  params: InventoryListParams,
  defaults: Pick<InventoryListParams, "page" | "limit" | "sort">,
  searchFields: readonly string[],
  normalizeOne: (raw: unknown) => T | null,
): Promise<PaginatedResult<T>> {
  return fetchPaginatedResourceList({
    endpoint,
    page: params.page ?? defaults.page,
    limit: params.limit ?? defaults.limit,
    offset: params.offset,
    isFiltered: hasInventoryListFilters(params),
    buildGetQuery: () => buildInventoryListQuery(params, defaults),
    buildSearchBody: () => buildInventorySearchBody(params, defaults.sort, searchFields),
    normalize: (payload, context) => normalizePaginated(payload, normalizeOne, context),
  });
}

async function setActiveMany<T extends InventoryVersionedRef>(
  endpoint: string,
  records: T[],
  isActive: boolean,
  fallbackMessage: string,
): Promise<BulkSettledResult<string>> {
  const unique = [...new Map(records.map((record) => [record.id, record])).values()];
  return runSettledWithConcurrency(unique, {
    getId: (record) => record.id,
    run: async (record) => {
      const id = parseInventoryPathId(record.id);
      const response = await apiClient.patch<ApiMutationEnvelope<unknown>>(
        `${endpoint}/${id}`,
        { isActive },
        headers(inventoryIfMatchHeaders(record.version)),
      );
      assertMutationSuccess(response, fallbackMessage);
    },
  });
}

/* ----------------------------------------------------------------- Items */

export function fetchInventoryItems(params: InventoryListParams = {}): Promise<PaginatedResult<InventoryItem>> {
  return listResource(
    API_ENDPOINTS.INVENTORY_ITEMS,
    params,
    DEFAULT_INVENTORY_ITEM_LIST_PARAMS,
    INVENTORY_ITEM_BAR_OR_SEARCH_FIELDS,
    normalizeInventoryItem,
  );
}

export function fetchInventoryItemById(itemId: string): Promise<InventoryItem> {
  return fetchById(API_ENDPOINTS.INVENTORY_ITEMS, itemId, normalizeInventoryItem, "Inventory item not found.");
}

export async function createInventoryItem(values: InventoryFormValues): Promise<InventoryItem> {
  return createRecord(
    API_ENDPOINTS.INVENTORY_ITEMS,
    { ...requirePayload(buildInventoryItemPayload(values)), isActive: true },
    normalizeInventoryItem,
    fetchInventoryItemById,
    "Unable to create inventory item.",
  );
}

export async function updateInventoryItem(item: InventoryVersionedRef, values: InventoryFormValues): Promise<InventoryItem> {
  return patchRecord(
    API_ENDPOINTS.INVENTORY_ITEMS,
    item,
    requirePayload(buildInventoryItemPayload(values)),
    normalizeInventoryItem,
    fetchInventoryItemById,
    "Unable to update inventory item.",
  );
}

/** The API has no item DELETE; items are retired by deactivating them. */
export function setInventoryItemsActive(
  items: InventoryVersionedRef[],
  isActive: boolean,
): Promise<BulkSettledResult<string>> {
  return setActiveMany(API_ENDPOINTS.INVENTORY_ITEMS, items, isActive, "Unable to update inventory item.");
}

/* ----------------------------------------------------------------- Stock */

export function fetchInventoryStock(
  params: InventoryListParams = {},
): Promise<PaginatedResult<InventoryStockBalance>> {
  return listResource(
    API_ENDPOINTS.INVENTORY_STOCK,
    params,
    DEFAULT_INVENTORY_STOCK_LIST_PARAMS,
    INVENTORY_STOCK_BAR_OR_SEARCH_FIELDS,
    normalizeInventoryStockBalance,
  );
}

export async function fetchHolderStock(holderId: string): Promise<InventoryStockBalance[]> {
  const id = parseInventoryPathId(holderId);
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(`${API_ENDPOINTS.INVENTORY_HOLDERS}/${id}/stock`);
  return Array.isArray(response.data)
    ? response.data.map(normalizeInventoryStockBalance).filter((row): row is InventoryStockBalance => row != null)
    : [];
}

/* --------------------------------------------------------------- Holders */

export function fetchInventoryHolders(params: InventoryListParams = {}): Promise<PaginatedResult<InventoryHolder>> {
  return listResource(
    API_ENDPOINTS.INVENTORY_HOLDERS,
    params,
    DEFAULT_INVENTORY_HOLDER_LIST_PARAMS,
    INVENTORY_HOLDER_BAR_OR_SEARCH_FIELDS,
    normalizeInventoryHolder,
  );
}

export function fetchInventoryHolderById(holderId: string): Promise<InventoryHolder> {
  return fetchById(API_ENDPOINTS.INVENTORY_HOLDERS, holderId, normalizeInventoryHolder, "Inventory holder not found.");
}

export async function createInventoryHolder(values: InventoryHolderFormValues): Promise<InventoryHolder> {
  return createRecord(
    API_ENDPOINTS.INVENTORY_HOLDERS,
    requirePayload(buildInventoryHolderPayload(values)),
    normalizeInventoryHolder,
    fetchInventoryHolderById,
    "Unable to create inventory holder.",
  );
}

export async function fetchRouteCrews(): Promise<InventoryRouteCrew[]> {
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.ROUTE_CREWS}?${buildApiListQuery({ page: 1, limit: 200, sort: "name:asc" })}`,
  );
  return Array.isArray(response.data)
    ? response.data.map(normalizeRouteCrew).filter((crew): crew is InventoryRouteCrew => crew != null)
    : [];
}

/* -------------------------------------------------------------- Receipts */

export function fetchInventoryReceipts(params: InventoryListParams = {}): Promise<PaginatedResult<InventoryReceipt>> {
  return listResource(
    API_ENDPOINTS.INVENTORY_RECEIPTS,
    params,
    DEFAULT_INVENTORY_RECEIPT_LIST_PARAMS,
    INVENTORY_RECEIPT_BAR_OR_SEARCH_FIELDS,
    normalizeInventoryReceipt,
  );
}

export function fetchInventoryReceiptById(receiptId: string): Promise<InventoryReceipt> {
  return fetchById(API_ENDPOINTS.INVENTORY_RECEIPTS, receiptId, normalizeInventoryReceipt, "Inventory receipt not found.");
}

/** Creates a DRAFT receipt; stock changes only when it is posted. */
export async function createInventoryReceipt(values: ReceiptFormValues): Promise<InventoryReceipt> {
  return createRecord(
    API_ENDPOINTS.INVENTORY_RECEIPTS,
    requirePayload(buildInventoryReceiptPayload(values)),
    normalizeInventoryReceipt,
    fetchInventoryReceiptById,
    "Unable to create inventory receipt.",
  );
}

export async function updateInventoryReceipt(receipt: InventoryVersionedRef, values: ReceiptFormValues): Promise<InventoryReceipt> {
  return patchRecord(
    API_ENDPOINTS.INVENTORY_RECEIPTS,
    receipt,
    requirePayload(buildInventoryReceiptPayload(values)),
    normalizeInventoryReceipt,
    fetchInventoryReceiptById,
    "Unable to update inventory receipt.",
  );
}

export function postInventoryReceipt(receipt: InventoryVersionedRef): Promise<void> {
  return runDocumentCommand(API_ENDPOINTS.INVENTORY_RECEIPTS, "receipt", "post", receipt, "Unable to post inventory receipt.");
}

export function cancelInventoryReceipt(receipt: InventoryVersionedRef): Promise<void> {
  return runDocumentCommand(API_ENDPOINTS.INVENTORY_RECEIPTS, "receipt", "cancel", receipt, "Unable to cancel inventory receipt.");
}

/* ------------------------------------------------------------ Dispatches */

export function fetchInventoryDispatches(
  params: InventoryListParams = {},
): Promise<PaginatedResult<InventoryDispatch>> {
  return listResource(
    API_ENDPOINTS.INVENTORY_DISPATCHES,
    params,
    DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS,
    INVENTORY_DISPATCH_BAR_OR_SEARCH_FIELDS,
    normalizeInventoryDispatch,
  );
}

export function fetchInventoryDispatchById(dispatchId: string): Promise<InventoryDispatch> {
  return fetchById(
    API_ENDPOINTS.INVENTORY_DISPATCHES,
    dispatchId,
    normalizeInventoryDispatch,
    "Inventory dispatch not found.",
  );
}

/** Creates a DRAFT dispatch; stock moves between holders only when it is posted. */
export async function createInventoryDispatch(values: DispatchFormValues): Promise<InventoryDispatch> {
  return createRecord(
    API_ENDPOINTS.INVENTORY_DISPATCHES,
    requirePayload(buildInventoryDispatchPayload(values)),
    normalizeInventoryDispatch,
    fetchInventoryDispatchById,
    "Unable to create inventory dispatch.",
  );
}

export async function updateInventoryDispatch(
  dispatch: InventoryVersionedRef,
  values: DispatchFormValues,
): Promise<InventoryDispatch> {
  return patchRecord(
    API_ENDPOINTS.INVENTORY_DISPATCHES,
    dispatch,
    requirePayload(buildInventoryDispatchPayload(values)),
    normalizeInventoryDispatch,
    fetchInventoryDispatchById,
    "Unable to update inventory dispatch.",
  );
}

export function postInventoryDispatch(dispatch: InventoryVersionedRef): Promise<void> {
  return runDocumentCommand(API_ENDPOINTS.INVENTORY_DISPATCHES, "dispatch", "post", dispatch, "Unable to post inventory dispatch.");
}

export function cancelInventoryDispatch(dispatch: InventoryVersionedRef): Promise<void> {
  return runDocumentCommand(API_ENDPOINTS.INVENTORY_DISPATCHES, "dispatch", "cancel", dispatch, "Unable to cancel inventory dispatch.");
}

/* ----------------------------------------------------------- Adjustments */

/**
 * Creates a DRAFT adjustment and posts it. When posting fails the draft
 * remains available under Supply operations → Adjustments.
 */
export async function createAndPostInventoryAdjustment(values: AdjustmentFormValues): Promise<void> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.INVENTORY_ADJUSTMENTS,
    requirePayload(buildInventoryAdjustmentPayload(values)),
  );
  assertMutationSuccess(response, "Unable to create stock adjustment.");
  const created = asRecord(response.data);
  const id = readStringId(created?.id) ?? extractCreatedId(response);
  if (!id) throw new Error("Unable to create stock adjustment.");
  let version = readVersion(created?.version);
  if (version == null) {
    const fresh = asRecord(unwrapRecord(await apiClient.get<unknown>(`${API_ENDPOINTS.INVENTORY_ADJUSTMENTS}/${parseInventoryPathId(id)}`)));
    version = readVersion(fresh?.version);
  }
  await runDocumentCommand(
    API_ENDPOINTS.INVENTORY_ADJUSTMENTS,
    "adjustment",
    "post",
    { id, version },
    "Unable to post stock adjustment.",
  );
}

/* ------------------------------------------------------------- Suppliers */

export function fetchInventorySuppliers(
  params: InventoryListParams = {},
): Promise<PaginatedResult<InventorySupplier>> {
  return listResource(
    API_ENDPOINTS.INVENTORY_SUPPLIERS,
    params,
    DEFAULT_INVENTORY_SUPPLIER_LIST_PARAMS,
    INVENTORY_SUPPLIER_BAR_OR_SEARCH_FIELDS,
    normalizeInventorySupplier,
  );
}

export function fetchInventorySupplierById(supplierId: string): Promise<InventorySupplier> {
  return fetchById(
    API_ENDPOINTS.INVENTORY_SUPPLIERS,
    supplierId,
    normalizeInventorySupplier,
    "Inventory supplier not found.",
  );
}

export async function createInventorySupplier(values: SupplierFormValues): Promise<InventorySupplier> {
  return createRecord(
    API_ENDPOINTS.INVENTORY_SUPPLIERS,
    { ...requirePayload(buildInventorySupplierPayload(values)), isActive: true },
    normalizeInventorySupplier,
    fetchInventorySupplierById,
    "Unable to create inventory supplier.",
  );
}

export async function updateInventorySupplier(
  supplier: InventoryVersionedRef,
  values: SupplierFormValues,
): Promise<InventorySupplier> {
  return patchRecord(
    API_ENDPOINTS.INVENTORY_SUPPLIERS,
    supplier,
    requirePayload(buildInventorySupplierPayload(values)),
    normalizeInventorySupplier,
    fetchInventorySupplierById,
    "Unable to update inventory supplier.",
  );
}

/** The API has no supplier DELETE; suppliers are retired by deactivating them. */
export function setInventorySuppliersActive(
  suppliers: InventoryVersionedRef[],
  isActive: boolean,
): Promise<BulkSettledResult<string>> {
  return setActiveMany(API_ENDPOINTS.INVENTORY_SUPPLIERS, suppliers, isActive, "Unable to update inventory supplier.");
}
