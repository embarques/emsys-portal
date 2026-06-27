import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery } from "@/lib/api/list-query";
import {
  buildResourceSearchFilterGroups,
  buildStripeStyleSearchBody,
  hasResourceListFilters,
} from "@/lib/api/search-query";
import { ITEM_BAR_OR_SEARCH_FIELDS } from "@/lib/items/search-fields";
import { ITEM_TABLE_FILTER_FIELDS } from "@/lib/items/filter-fields";
import { expandItemFilterNode } from "@/lib/items/item-filters";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import {
  DEFAULT_ITEM_LIST_PARAMS,
  validateItemFormValues,
  type Item,
  type ItemFormValues,
  type ItemListParams,
} from "@/lib/items/types";

type ApiInvoiceDescription = {
  id?: number;
  name?: string;
  price?: number;
  createdAt?: string;
  updatedAt?: string;
};

/** POST/PUT /invoice-descriptions */
type ApiInvoiceDescriptionWritePayload = {
  name: string;
  price: number;
  id?: number;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

function readNumericId(value: number | string | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeItem(raw: unknown): Item | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiInvoiceDescription;
  const id = readNumericId(item.id);
  if (id == null || id <= 0) return null;

  return {
    itemId: String(id),
    description: String(item.name ?? "").trim(),
    price: Number(item.price ?? 0),
    createdAt: String(item.createdAt ?? "").trim(),
    updatedAt: String(item.updatedAt ?? "").trim(),
  };
}

function normalizePaginatedItems(payload: PaginatedApiEnvelope<unknown[]>): PaginatedResult<Item> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeItem).filter((item): item is Item => item != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: payload.total ?? items.length,
  };
}

function hasItemListFilters(params: ItemListParams): boolean {
  return hasResourceListFilters({
    search: params.search,
    filterRows: params.filterRows,
    tableFilterFields: ITEM_TABLE_FILTER_FIELDS,
  });
}

function buildItemsQuery(params: ItemListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_ITEM_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_ITEM_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_ITEM_LIST_PARAMS.sort,
  });
}

function buildItemSearchBody(params: ItemListParams) {
  return buildStripeStyleSearchBody({
    sort: params.sort ?? DEFAULT_ITEM_LIST_PARAMS.sort,
    filterGroups: buildResourceSearchFilterGroups({
      search: params.search,
      barOrSearchFields: ITEM_BAR_OR_SEARCH_FIELDS,
      filterRows: params.filterRows,
      tableFilterFields: ITEM_TABLE_FILTER_FIELDS,
      expandNode: expandItemFilterNode,
    }),
  });
}

function buildItemWritePayload(
  values: ItemFormValues,
  options: { itemId?: number } = {},
): ApiInvoiceDescriptionWritePayload {
  validateItemFormValues(values);

  const payload: ApiInvoiceDescriptionWritePayload = {
    name: values.description.trim(),
    price: Number(values.price),
  };

  if (options.itemId) {
    payload.id = options.itemId;
  }

  return payload;
}

function assertMutationSuccess(response: ApiMutationEnvelope<unknown>, fallbackMessage: string) {
  if (response.success === false) {
    throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
  }
}

function extractItemFromMutationResponse(data: unknown): Item | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeItem(data);
  }
  return null;
}

function extractCreatedItemId(response: ApiMutationEnvelope<unknown>): number | null {
  const data = response.data;

  if (typeof data === "number" && Number.isFinite(data)) {
    return data;
  }

  if (typeof data === "string") {
    const id = Number(data.trim());
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  const item = extractItemFromMutationResponse(data);
  return item ? readNumericId(item.itemId) ?? null : null;
}

function parseItemPathId(itemId: string | number): number {
  const numericId = readNumericId(itemId);
  if (numericId == null || numericId <= 0) {
    throw new Error("Invalid item ID.");
  }
  return numericId;
}

async function resolveCreatedItem(
  values: ItemFormValues,
  response: ApiMutationEnvelope<unknown>,
): Promise<Item> {
  const createdId = extractCreatedItemId(response);
  if (createdId) {
    return fetchItemById(createdId);
  }

  const item = extractItemFromMutationResponse(response.data);
  if (item) {
    return item;
  }

  const name = values.description.trim();
  if (name) {
    const matches = await fetchItems({
      page: 1,
      limit: 1,
      search: { field: "name", operator: "eq", value: name },
    });

    const matchedItem = matches.items[0];
    if (matchedItem) {
      return matchedItem;
    }
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to create item.");
}

export async function fetchItems(params: ItemListParams = {}): Promise<PaginatedResult<Item>> {
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.INVOICE_DESCRIPTIONS,
    page: params.page ?? DEFAULT_ITEM_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_ITEM_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasItemListFilters(params),
    buildGetQuery: () => buildItemsQuery(params),
    buildSearchBody: () => buildItemSearchBody(params),
    normalize: normalizePaginatedItems,
  });
}

export async function fetchItemById(itemId: string | number): Promise<Item> {
  const numericId = parseItemPathId(itemId);
  const response = await apiClient.get<ApiInvoiceDescription | PaginatedApiEnvelope<ApiInvoiceDescription>>(
    `${API_ENDPOINTS.INVOICE_DESCRIPTIONS}/${numericId}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiInvoiceDescription>).data
      : response;

  const item = normalizeItem(raw);
  if (!item) {
    throw new Error("Item not found.");
  }

  return item;
}

export async function createItem(values: ItemFormValues): Promise<Item> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.INVOICE_DESCRIPTIONS,
    buildItemWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create item.");

  return resolveCreatedItem(values, response);
}

export async function updateItem(itemId: string | number, values: ItemFormValues): Promise<Item> {
  const numericId = parseItemPathId(itemId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.INVOICE_DESCRIPTIONS}/${numericId}`,
    buildItemWritePayload(values, { itemId: numericId }),
  );

  assertMutationSuccess(response, "Unable to update item.");

  const updatedItem = extractItemFromMutationResponse(response.data);
  if (updatedItem) {
    return updatedItem;
  }

  return fetchItemById(numericId);
}

export async function deleteItem(itemId: string | number): Promise<void> {
  const numericId = parseItemPathId(itemId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.INVOICE_DESCRIPTIONS}/${numericId}`,
  );

  assertMutationSuccess(response, "Unable to delete item.");
}

export async function deleteItems(itemIds: Array<string | number>): Promise<void> {
  await Promise.all(itemIds.map((itemId) => deleteItem(itemId)));
}
