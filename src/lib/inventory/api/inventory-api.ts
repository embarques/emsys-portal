import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery } from "@/lib/api/list-query";
import {
  buildResourceSearchFilterGroups,
  buildStripeStyleSearchBody,
  hasResourceListFilters,
  type ApiSearchFilter,
} from "@/lib/api/search-query";
import { resolvePaginatedListTotal, type PaginatedApiEnvelope, type PaginatedResult } from "@/lib/api/types";
import { buildApiPhonesPayload, normalizeRecordPhonesFromApi, validateRecordPhones } from "@/lib/phones/phones";
import {
  INVENTORY_DISPATCH_BAR_OR_SEARCH_FIELDS,
  INVENTORY_ITEM_BAR_OR_SEARCH_FIELDS,
  INVENTORY_RECEIPT_BAR_OR_SEARCH_FIELDS,
  INVENTORY_STOCK_BAR_OR_SEARCH_FIELDS,
  INVENTORY_SUPPLIER_BAR_OR_SEARCH_FIELDS,
} from "@/lib/inventory/search-fields";
import { parseInventoryFormNumber, type InventoryFormValues, type InventoryItem, type InventoryStock } from "@/lib/inventory/types/catalog";
import {
  dispatchedToFromFormValues,
  type DispatchFormValues,
  type InventoryDispatch,
  type InventoryDispatchTo,
  type InventoryItemRef,
  type InventoryReceipt,
  type InventorySupplierRef,
  type ReceiptFormValues,
} from "@/lib/inventory/types/documents";
import {
  DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS,
  DEFAULT_INVENTORY_ITEM_LIST_PARAMS,
  DEFAULT_INVENTORY_RECEIPT_LIST_PARAMS,
  DEFAULT_INVENTORY_STOCK_LIST_PARAMS,
  DEFAULT_INVENTORY_SUPPLIER_LIST_PARAMS,
  type InventoryListParams,
} from "@/lib/inventory/types/list";
import { compactStringList, type InventorySupplier, type SupplierFormValues } from "@/lib/inventory/types/suppliers";

type ApiUser = {
  id?: number | string;
  name?: string;
  userName?: string;
  fullName?: string;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

function readStringId(value: unknown): string | undefined {
  if (value == null) return undefined;
  const id = String(value).trim();
  return id || undefined;
}

function readNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readUserName(user: unknown): string {
  if (!user) return "";
  if (typeof user === "string") return user.trim();
  if (typeof user === "object") {
    const entry = user as ApiUser;
    return String(entry.fullName ?? entry.userName ?? entry.name ?? "").trim();
  }
  return "";
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
  return trimmed;
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

function normalizeItemRef(raw: unknown, fallbackId?: string): InventoryItemRef | undefined {
  if (raw && typeof raw === "object") {
    const entry = raw as { id?: unknown; item?: unknown; name?: unknown };
    const id = readStringId(entry.id) ?? fallbackId;
    const item = String(entry.item ?? entry.name ?? "").trim();
    if (id) return { id, item };
  }
  return fallbackId ? { id: fallbackId, item: "" } : undefined;
}

function normalizeSupplierRef(raw: unknown, fallbackId?: string): InventorySupplierRef | undefined {
  if (raw && typeof raw === "object") {
    const entry = raw as { id?: unknown; companyName?: unknown; name?: unknown };
    const id = readStringId(entry.id) ?? fallbackId;
    const companyName = String(entry.companyName ?? entry.name ?? "").trim();
    if (id) return { id, companyName };
  }
  return fallbackId ? { id: fallbackId, companyName: "" } : undefined;
}

function normalizeDispatchTo(raw: unknown): InventoryDispatchTo | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as {
    id?: unknown;
    _id?: unknown;
    name?: unknown;
    route?: { id?: unknown; _id?: unknown; name?: unknown };
  };
  const id = entry.id ?? entry._id;
  const name = String(entry.name ?? "").trim();
  if (id == null || id === "" || !name) return null;

  const nested = entry.route;
  const nestedId = nested?.id ?? nested?._id;
  const nestedName = String(nested?.name ?? "").trim();
  const numericId = typeof id === "number" ? id : Number(id);
  return {
    id: typeof id === "number" || Number.isFinite(numericId) ? (typeof id === "number" ? id : numericId) : String(id),
    name,
    ...(nestedId != null && nestedId !== "" && nestedName
      ? {
          route: {
            id: typeof nestedId === "number" ? nestedId : String(nestedId),
            name: nestedName,
          },
        }
      : {}),
  };
}

function hasInventoryListFilters(params: InventoryListParams): boolean {
  return (
    hasResourceListFilters({ search: params.search }) ||
    Boolean(params.itemId?.trim()) ||
    Boolean(params.supplierId?.trim())
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
  if (params.itemId?.trim()) {
    filters.push({ field: "itemId", operator: "eq", value: params.itemId.trim() });
  }
  if (params.supplierId?.trim()) {
    filters.push({ field: "supplierId", operator: "eq", value: params.supplierId.trim() });
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

function normalizeInventoryItem(raw: unknown): InventoryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;
  const id = readStringId(entry.id);
  if (!id) return null;

  return {
    id,
    item: String(entry.item ?? "").trim(),
    reorderThreshold: readNumber(entry.reorderThreshold),
    quantity: readNumber(entry.quantity),
    averageCost: readNumber(entry.averageCost),
    createdAt: String(entry.createdAt ?? "").trim(),
    createdBy: readUserName(entry.createdBy),
    updatedAt: String(entry.updatedAt ?? "").trim(),
    updatedBy: readUserName(entry.updatedBy),
  };
}

function normalizeInventoryStock(raw: unknown): InventoryStock | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;
  const id = readStringId(entry.id);
  const itemId = readStringId(entry.itemId) ?? id;
  if (!id || !itemId) return null;

  return {
    id,
    itemId,
    item: normalizeItemRef(entry.item, itemId),
    quantity: readNumber(entry.quantity),
    averageCost: readNumber(entry.averageCost),
    reorderThreshold: readNumber(entry.reorderThreshold),
    createdAt: String(entry.createdAt ?? "").trim(),
    createdBy: readUserName(entry.createdBy),
    updatedAt: String(entry.updatedAt ?? "").trim(),
    updatedBy: readUserName(entry.updatedBy),
  };
}

function normalizeInventoryReceipt(raw: unknown): InventoryReceipt | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;
  const id = readStringId(entry.id);
  const itemId = readStringId(entry.itemId) ?? readStringId((entry.item as { id?: unknown } | undefined)?.id);
  const supplierId =
    readStringId(entry.supplierId) ?? readStringId((entry.supplier as { id?: unknown } | undefined)?.id);
  if (!id || !itemId || !supplierId) return null;

  return {
    id,
    itemId,
    item: normalizeItemRef(entry.item, itemId),
    quantity: readNumber(entry.quantity),
    averageCost: readNumber(entry.averageCost),
    supplierId,
    supplier: normalizeSupplierRef(entry.supplier, supplierId),
    receivedAt: String(entry.receivedAt ?? "").trim().slice(0, 10),
    createdAt: String(entry.createdAt ?? "").trim(),
    createdBy: readUserName(entry.createdBy),
    updatedAt: String(entry.updatedAt ?? "").trim(),
    updatedBy: readUserName(entry.updatedBy),
  };
}

function normalizeInventoryDispatch(raw: unknown): InventoryDispatch | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;
  const id = readStringId(entry.id);
  const itemId = readStringId(entry.itemId) ?? readStringId((entry.item as { id?: unknown } | undefined)?.id);
  const dispatchedTo = normalizeDispatchTo(entry.dispatchedTo);
  if (!id || !itemId || !dispatchedTo) return null;

  return {
    id,
    itemId,
    item: normalizeItemRef(entry.item, itemId),
    quantity: readNumber(entry.quantity),
    incomeGained: readNumber(entry.incomeGained),
    dispatchedAt: String(entry.dispatchedAt ?? "").trim().slice(0, 10),
    dispatchedTo,
    createdAt: String(entry.createdAt ?? "").trim(),
    createdBy: readUserName(entry.createdBy),
    updatedAt: String(entry.updatedAt ?? "").trim(),
    updatedBy: readUserName(entry.updatedBy),
  };
}

function normalizeInventorySupplier(raw: unknown): InventorySupplier | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;
  const id = readStringId(entry.id);
  if (!id) return null;

  return {
    id,
    companyName: String(entry.companyName ?? "").trim(),
    contactNames: Array.isArray(entry.contactNames)
      ? entry.contactNames.map((value) => String(value).trim()).filter(Boolean)
      : [],
    addresses: Array.isArray(entry.addresses)
      ? entry.addresses.map((value) => String(value).trim()).filter(Boolean)
      : [],
    phones: normalizeRecordPhonesFromApi(entry),
    emails: Array.isArray(entry.emails) ? entry.emails.map((value) => String(value).trim()).filter(Boolean) : [],
    createdAt: String(entry.createdAt ?? "").trim(),
    createdBy: readUserName(entry.createdBy),
    updatedAt: String(entry.updatedAt ?? "").trim(),
    updatedBy: readUserName(entry.updatedBy),
  };
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
  const createdId = extractCreatedId(response);
  if (createdId) {
    return fetchOne(createdId);
  }

  const entity = normalizeOne(response.data);
  if (entity) {
    return entity;
  }

  throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
}

function buildItemWritePayload(values: InventoryFormValues) {
  return {
    item: values.item.trim(),
    reorderThreshold: parseInventoryFormNumber(values.reorderThreshold),
  };
}

function buildReceiptWritePayload(values: ReceiptFormValues) {
  return {
    itemId: values.itemId.trim(),
    quantity: parseInventoryFormNumber(values.quantity),
    averageCost: parseInventoryFormNumber(values.averageCost),
    supplierId: values.supplierId.trim(),
    receivedAt: values.receivedAt.trim().slice(0, 10),
  };
}

function buildDispatchWritePayload(values: DispatchFormValues) {
  const dispatchedTo = dispatchedToFromFormValues(values);
  if (!dispatchedTo) {
    throw new Error("Dispatched to is required");
  }

  return {
    itemId: values.itemId.trim(),
    quantity: parseInventoryFormNumber(values.quantity),
    incomeGained: parseInventoryFormNumber(values.incomeGained),
    dispatchedAt: values.dispatchedAt.trim().slice(0, 10),
    dispatchedTo,
  };
}

function buildSupplierWritePayload(values: SupplierFormValues) {
  const phones = values.phones.filter((phone) => phone.number.trim());
  if (phones.length > 0) {
    validateRecordPhones(phones, { required: false });
  }

  return {
    companyName: values.companyName.trim(),
    contactNames: compactStringList(values.contactNames),
    addresses: compactStringList(values.addresses),
    phones: phones.length > 0 ? buildApiPhonesPayload(phones) : [],
    emails: compactStringList(values.emails),
  };
}

export async function fetchInventoryItems(
  params: InventoryListParams = {},
): Promise<PaginatedResult<InventoryItem>> {
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.INVENTORY_ITEMS,
    page: params.page ?? DEFAULT_INVENTORY_ITEM_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_INVENTORY_ITEM_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasInventoryListFilters(params),
    buildGetQuery: () => buildInventoryListQuery(params, DEFAULT_INVENTORY_ITEM_LIST_PARAMS),
    buildSearchBody: () =>
      buildInventorySearchBody(params, DEFAULT_INVENTORY_ITEM_LIST_PARAMS.sort, INVENTORY_ITEM_BAR_OR_SEARCH_FIELDS),
    normalize: (payload, context) => normalizePaginated(payload, normalizeInventoryItem, context),
  });
}

export async function fetchInventoryItemById(itemId: string): Promise<InventoryItem> {
  return fetchById(API_ENDPOINTS.INVENTORY_ITEMS, itemId, normalizeInventoryItem, "Inventory item not found.");
}

export async function createInventoryItem(values: InventoryFormValues): Promise<InventoryItem> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.INVENTORY_ITEMS,
    buildItemWritePayload(values),
  );
  assertMutationSuccess(response, "Unable to create inventory item.");
  return resolveCreated(response, normalizeInventoryItem, fetchInventoryItemById, "Unable to create inventory item.");
}

export async function updateInventoryItem(itemId: string, values: InventoryFormValues): Promise<InventoryItem> {
  const id = parseInventoryPathId(itemId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.INVENTORY_ITEMS}/${id}`,
    buildItemWritePayload(values),
  );
  assertMutationSuccess(response, "Unable to update inventory item.");
  return normalizeInventoryItem(response.data) ?? fetchInventoryItemById(id);
}

export async function deleteInventoryItem(itemId: string): Promise<void> {
  const id = parseInventoryPathId(itemId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(`${API_ENDPOINTS.INVENTORY_ITEMS}/${id}`);
  assertMutationSuccess(response, "Unable to delete inventory item.");
}

export async function deleteInventoryItems(itemIds: string[]): Promise<void> {
  await Promise.all(itemIds.map((itemId) => deleteInventoryItem(itemId)));
}

export async function fetchInventoryStock(
  params: InventoryListParams = {},
): Promise<PaginatedResult<InventoryStock>> {
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.INVENTORY_STOCK,
    page: params.page ?? DEFAULT_INVENTORY_STOCK_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_INVENTORY_STOCK_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasInventoryListFilters(params),
    buildGetQuery: () => buildInventoryListQuery(params, DEFAULT_INVENTORY_STOCK_LIST_PARAMS),
    buildSearchBody: () =>
      buildInventorySearchBody(params, DEFAULT_INVENTORY_STOCK_LIST_PARAMS.sort, INVENTORY_STOCK_BAR_OR_SEARCH_FIELDS),
    normalize: (payload, context) => normalizePaginated(payload, normalizeInventoryStock, context),
  });
}

export async function fetchInventoryStockById(stockId: string): Promise<InventoryStock> {
  return fetchById(API_ENDPOINTS.INVENTORY_STOCK, stockId, normalizeInventoryStock, "Inventory stock not found.");
}

export async function fetchInventoryReceipts(
  params: InventoryListParams = {},
): Promise<PaginatedResult<InventoryReceipt>> {
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.INVENTORY_RECEIPTS,
    page: params.page ?? DEFAULT_INVENTORY_RECEIPT_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_INVENTORY_RECEIPT_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasInventoryListFilters(params),
    buildGetQuery: () => buildInventoryListQuery(params, DEFAULT_INVENTORY_RECEIPT_LIST_PARAMS),
    buildSearchBody: () =>
      buildInventorySearchBody(
        params,
        DEFAULT_INVENTORY_RECEIPT_LIST_PARAMS.sort,
        INVENTORY_RECEIPT_BAR_OR_SEARCH_FIELDS,
      ),
    normalize: (payload, context) => normalizePaginated(payload, normalizeInventoryReceipt, context),
  });
}

export async function fetchInventoryReceiptById(receiptId: string): Promise<InventoryReceipt> {
  return fetchById(API_ENDPOINTS.INVENTORY_RECEIPTS, receiptId, normalizeInventoryReceipt, "Inventory receipt not found.");
}

export async function createInventoryReceipt(values: ReceiptFormValues): Promise<InventoryReceipt> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.INVENTORY_RECEIPTS,
    buildReceiptWritePayload(values),
  );
  assertMutationSuccess(response, "Unable to create inventory receipt.");
  return resolveCreated(
    response,
    normalizeInventoryReceipt,
    fetchInventoryReceiptById,
    "Unable to create inventory receipt.",
  );
}

export async function updateInventoryReceipt(receiptId: string, values: ReceiptFormValues): Promise<InventoryReceipt> {
  const id = parseInventoryPathId(receiptId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.INVENTORY_RECEIPTS}/${id}`,
    buildReceiptWritePayload(values),
  );
  assertMutationSuccess(response, "Unable to update inventory receipt.");
  return normalizeInventoryReceipt(response.data) ?? fetchInventoryReceiptById(id);
}

export async function deleteInventoryReceipt(receiptId: string): Promise<void> {
  const id = parseInventoryPathId(receiptId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(`${API_ENDPOINTS.INVENTORY_RECEIPTS}/${id}`);
  assertMutationSuccess(response, "Unable to delete inventory receipt.");
}

export async function fetchInventoryDispatches(
  params: InventoryListParams = {},
): Promise<PaginatedResult<InventoryDispatch>> {
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.INVENTORY_DISPATCHES,
    page: params.page ?? DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasInventoryListFilters(params),
    buildGetQuery: () => buildInventoryListQuery(params, DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS),
    buildSearchBody: () =>
      buildInventorySearchBody(
        params,
        DEFAULT_INVENTORY_DISPATCH_LIST_PARAMS.sort,
        INVENTORY_DISPATCH_BAR_OR_SEARCH_FIELDS,
      ),
    normalize: (payload, context) => normalizePaginated(payload, normalizeInventoryDispatch, context),
  });
}

export async function fetchInventoryDispatchById(dispatchId: string): Promise<InventoryDispatch> {
  return fetchById(
    API_ENDPOINTS.INVENTORY_DISPATCHES,
    dispatchId,
    normalizeInventoryDispatch,
    "Inventory dispatch not found.",
  );
}

export async function createInventoryDispatch(values: DispatchFormValues): Promise<InventoryDispatch> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.INVENTORY_DISPATCHES,
    buildDispatchWritePayload(values),
  );
  assertMutationSuccess(response, "Unable to create inventory dispatch.");
  return resolveCreated(
    response,
    normalizeInventoryDispatch,
    fetchInventoryDispatchById,
    "Unable to create inventory dispatch.",
  );
}

export async function updateInventoryDispatch(
  dispatchId: string,
  values: DispatchFormValues,
): Promise<InventoryDispatch> {
  const id = parseInventoryPathId(dispatchId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.INVENTORY_DISPATCHES}/${id}`,
    buildDispatchWritePayload(values),
  );
  assertMutationSuccess(response, "Unable to update inventory dispatch.");
  return normalizeInventoryDispatch(response.data) ?? fetchInventoryDispatchById(id);
}

export async function deleteInventoryDispatch(dispatchId: string): Promise<void> {
  const id = parseInventoryPathId(dispatchId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(`${API_ENDPOINTS.INVENTORY_DISPATCHES}/${id}`);
  assertMutationSuccess(response, "Unable to delete inventory dispatch.");
}

export async function fetchInventorySuppliers(
  params: InventoryListParams = {},
): Promise<PaginatedResult<InventorySupplier>> {
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.INVENTORY_SUPPLIERS,
    page: params.page ?? DEFAULT_INVENTORY_SUPPLIER_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_INVENTORY_SUPPLIER_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasInventoryListFilters(params),
    buildGetQuery: () => buildInventoryListQuery(params, DEFAULT_INVENTORY_SUPPLIER_LIST_PARAMS),
    buildSearchBody: () =>
      buildInventorySearchBody(
        params,
        DEFAULT_INVENTORY_SUPPLIER_LIST_PARAMS.sort,
        INVENTORY_SUPPLIER_BAR_OR_SEARCH_FIELDS,
      ),
    normalize: (payload, context) => normalizePaginated(payload, normalizeInventorySupplier, context),
  });
}

export async function fetchInventorySupplierById(supplierId: string): Promise<InventorySupplier> {
  return fetchById(
    API_ENDPOINTS.INVENTORY_SUPPLIERS,
    supplierId,
    normalizeInventorySupplier,
    "Inventory supplier not found.",
  );
}

export async function createInventorySupplier(values: SupplierFormValues): Promise<InventorySupplier> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.INVENTORY_SUPPLIERS,
    buildSupplierWritePayload(values),
  );
  assertMutationSuccess(response, "Unable to create inventory supplier.");
  return resolveCreated(
    response,
    normalizeInventorySupplier,
    fetchInventorySupplierById,
    "Unable to create inventory supplier.",
  );
}

export async function updateInventorySupplier(
  supplierId: string,
  values: SupplierFormValues,
): Promise<InventorySupplier> {
  const id = parseInventoryPathId(supplierId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.INVENTORY_SUPPLIERS}/${id}`,
    buildSupplierWritePayload(values),
  );
  assertMutationSuccess(response, "Unable to update inventory supplier.");
  return normalizeInventorySupplier(response.data) ?? fetchInventorySupplierById(id);
}

export async function deleteInventorySupplier(supplierId: string): Promise<void> {
  const id = parseInventoryPathId(supplierId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.INVENTORY_SUPPLIERS}/${id}`,
  );
  assertMutationSuccess(response, "Unable to delete inventory supplier.");
}

export async function deleteInventorySuppliers(supplierIds: string[]): Promise<void> {
  await Promise.all(supplierIds.map((supplierId) => deleteInventorySupplier(supplierId)));
}
