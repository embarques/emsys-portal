import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import {
  runSettledIdsWithConcurrency,
  type BulkSettledResult,
} from "@/lib/api/run-settled-with-concurrency";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery } from "@/lib/api/list-query";
import {
  buildResourceSearchFilterGroups,
  buildStripeStyleSearchBody,
  hasResourceListFilters,
} from "@/lib/api/search-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { BARCODE_TABLE_FILTER_FIELDS } from "@/lib/barcodes/filter-fields";
import { expandBarcodeFilterNode } from "@/lib/barcodes/barcodes-filters";
import { BARCODE_BAR_OR_SEARCH_FIELDS } from "@/lib/barcodes/search-fields";
import {
  DEFAULT_BARCODE_LIST_PARAMS,
  validateBarcodeFormValues,
  type Barcode,
  type BarcodeFormValues,
  type BarcodeListParams,
} from "@/lib/barcodes/types";
import {
  createBarcode,
  fetchBarcodeById,
  normalizeBarcode,
  resolveBarcodeIdentity,
  updateBarcode,
  type BarcodeWritePayload,
} from "@/lib/labels/api/barcodes-api";
import { fetchBarcodeStatusOptions } from "@/lib/barcodes/api/barcode-status-options-api";
import type { BarcodeStatusOption } from "@/lib/labels/types";
import { formatContainerLabel } from "@/lib/containers/display";
import type { Container } from "@/lib/containers/types";
import { createFilterRowId } from "@/lib/table/filter-builder";
import type { TableFilterRowState } from "@/lib/table/filter-types";

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

function hasBarcodeListFilters(params: BarcodeListParams): boolean {
  return hasResourceListFilters({
    search: params.search,
    filterRows: params.filterRows,
    tableFilterFields: BARCODE_TABLE_FILTER_FIELDS,
  });
}

function buildBarcodeSearchBody(params: BarcodeListParams) {
  return buildStripeStyleSearchBody({
    sort: params.sort ?? DEFAULT_BARCODE_LIST_PARAMS.sort,
    filterGroups: buildResourceSearchFilterGroups({
      search: params.search,
      barOrSearchFields: BARCODE_BAR_OR_SEARCH_FIELDS,
      filterRows: params.filterRows,
      tableFilterFields: BARCODE_TABLE_FILTER_FIELDS,
      expandNode: expandBarcodeFilterNode,
    }),
  });
}

function buildBarcodesQuery(params: BarcodeListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_BARCODE_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_BARCODE_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_BARCODE_LIST_PARAMS.sort,
  });
}

function normalizePaginatedBarcodes(payload: PaginatedApiEnvelope<unknown[]>): PaginatedResult<Barcode> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeBarcode).filter((barcode): barcode is Barcode => barcode != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: payload.total ?? items.length,
  };
}

function parseBarcodePathId(barcodeId: string | number): number {
  const parsed = Number(barcodeId);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Invalid barcode ID.");
  }
  return parsed;
}

function resolveStatusRef(
  statusId: string,
  options: readonly BarcodeStatusOption[],
): { id: number; name: string } {
  const parsedId = Number(statusId);
  const option = options.find((entry) => entry.id === parsedId);
  if (!option) {
    throw new Error("Select a valid status.");
  }
  return { id: option.id, name: option.name };
}

function resolveContainerRef(
  containerId: string,
  containers: Container[],
): { id: number; name: string } | undefined {
  const trimmed = containerId.trim();
  if (!trimmed) return undefined;

  const parsedId = Number(trimmed);
  if (!Number.isFinite(parsedId) || parsedId <= 0) {
    throw new Error("Select a valid container.");
  }

  const container = containers.find((entry) => entry.id === parsedId);
  return {
    id: parsedId,
    name: container ? formatContainerLabel(container) : String(parsedId),
  };
}

async function buildBarcodeWritePayload(
  values: BarcodeFormValues,
  containers: Container[],
  statusOptions?: readonly BarcodeStatusOption[],
): Promise<BarcodeWritePayload> {
  validateBarcodeFormValues(values);

  const options = statusOptions?.length ? statusOptions : await fetchBarcodeStatusOptions();

  const payload: BarcodeWritePayload = {
    number: values.number.trim(),
    status: resolveStatusRef(values.statusId, options),
  };

  const container = resolveContainerRef(values.containerId, containers);
  if (container) {
    payload.container = container;
  }

  return payload;
}

export async function fetchBarcodes(params: BarcodeListParams = {}): Promise<PaginatedResult<Barcode>> {
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.BARCODES,
    page: params.page ?? DEFAULT_BARCODE_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_BARCODE_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasBarcodeListFilters(params),
    buildGetQuery: () => buildBarcodesQuery(params),
    buildSearchBody: () => buildBarcodeSearchBody(params),
    normalize: normalizePaginatedBarcodes,
  });
}

/** Advanced filter rows for barcodes assigned to a DR daily vehicle-route. */
export function buildBarcodeRouteFilterRows(routeId: string): TableFilterRowState[] {
  const id = routeId.trim();
  if (!id) return [];

  return [
    {
      id: createFilterRowId(),
      join: "and",
      field: "route.id",
      operator: "eq",
      value: id,
    },
  ];
}

/** Load every barcode assigned to a delivery vehicle-route. */
export async function fetchAllBarcodesByRoute(routeId: string): Promise<Barcode[]> {
  const trimmedRouteId = routeId.trim();
  if (!trimmedRouteId) return [];

  const filterRows = buildBarcodeRouteFilterRows(trimmedRouteId);
  const limit = 100;
  let page = 1;
  const items: Barcode[] = [];
  let total = 0;

  while (true) {
    const result = await fetchBarcodes({
      page,
      limit,
      sort: DEFAULT_BARCODE_LIST_PARAMS.sort,
      filterRows,
    });
    items.push(...result.items);
    total = result.total;
    if (items.length >= total || result.items.length === 0) break;
    page += 1;
  }

  return items;
}

/** Load barcodes assigned to any of the given delivery vehicle-routes. */
export async function fetchAllBarcodesByRoutes(routeIds: string[]): Promise<Barcode[]> {
  const uniqueRouteIds = [...new Set(routeIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueRouteIds.length === 0) return [];

  const batches = await Promise.all(uniqueRouteIds.map((routeId) => fetchAllBarcodesByRoute(routeId)));
  const byIdentity = new Map<string, Barcode>();

  for (const batch of batches) {
    for (const barcode of batch) {
      const identity = resolveBarcodeIdentity(barcode);
      if (!identity) continue;
      byIdentity.set(identity, barcode);
    }
  }

  return [...byIdentity.values()];
}

export async function createBarcodeRecord(
  values: BarcodeFormValues,
  containers: Container[],
  statusOptions?: readonly BarcodeStatusOption[],
): Promise<Barcode> {
  return createBarcode(await buildBarcodeWritePayload(values, containers, statusOptions));
}

export async function updateBarcodeRecord(
  barcodeId: string | number,
  values: BarcodeFormValues,
  containers: Container[],
  statusOptions?: readonly BarcodeStatusOption[],
): Promise<Barcode> {
  const numericId = parseBarcodePathId(barcodeId);
  return updateBarcode(
    numericId,
    await buildBarcodeWritePayload(values, containers, statusOptions),
  );
}

export async function fetchBarcodeRecord(barcodeId: string | number): Promise<Barcode> {
  return fetchBarcodeById(parseBarcodePathId(barcodeId));
}

export async function deleteBarcode(barcodeId: string | number): Promise<void> {
  const numericId = parseBarcodePathId(barcodeId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.BARCODES}/${numericId}`,
  );

  assertMutationSuccess(response, "Unable to delete barcode.");
}

export async function deleteBarcodes(
  barcodeIds: Array<string | number>,
): Promise<BulkSettledResult<string>> {
  const uniqueIds = [...new Set(barcodeIds.map((id) => String(id).trim()).filter(Boolean))];
  return runSettledIdsWithConcurrency(uniqueIds, deleteBarcode);
}
