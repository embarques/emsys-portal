import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { buildApiListQuery } from "@/lib/api/list-query";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import {
  buildResourceSearchFilterGroups,
  buildStripeStyleSearchBody,
  hasResourceListFilters,
} from "@/lib/api/search-query";
import { expandDeliveryFilterNode } from "@/lib/deliveries/delivery-filters";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { resolvePaginatedListTotal } from "@/lib/api/types";
import { DELIVERY_TABLE_FILTER_FIELDS } from "@/lib/deliveries/filter-fields";
import { DELIVERY_BAR_OR_SEARCH_FIELDS } from "@/lib/deliveries/search-fields";
import {
  DEFAULT_DELIVERY_LIST_PARAMS,
  toApiDate,
  validateDeliveryFormValues,
  type Delivery,
  type DeliveryBarcode,
  type DeliveryContainerRef,
  type DeliveryEmployeeGroupRef,
  type DeliveryFormValues,
  type DeliveryListParams,
  type DeliveryPackageBarcode,
  type DeliveryPackageContainerRef,
  type DeliveryPackageLineItem,
  type DeliveryPackageStatusRef,
  type DeliveryPackageUpdateResult,
} from "@/lib/deliveries/types";

type ApiRef = {
  id?: number | string;
  name?: string;
  containerNumber?: string;
};

type ApiEmployeeGroupRef = {
  id?: string | number;
  name?: string;
};

type ApiDelivery = {
  id?: number | string;
  name?: string;
  date?: string;
  container?: ApiRef;
  employeeGroup?: ApiEmployeeGroupRef | null;
  createdAt?: string;
  updatedAt?: string;
};

type ApiBarcode = {
  id?: number | string;
  number?: string;
  scanDate?: string;
  createdAt?: string;
  status?: { id?: number; name?: string };
  container?: ApiRef;
  delivery?: ApiRef;
  invoice?: { id?: string | number; number?: string };
  invoiceId?: string | number;
  invoiceNumber?: string | number;
  lineItemName?: string;
  name?: string;
  quantity?: number;
};

type ApiDeliveryContainerWriteRef = {
  id: number;
  name: string;
};

type ApiDeliveryCreatePayload = {
  date: string;
  container: ApiDeliveryContainerWriteRef;
  employeeGroup: DeliveryEmployeeGroupRef;
};

type ApiDeliveryUpdatePayload = {
  id: number;
  name: string;
  date: string;
  container: ApiDeliveryContainerWriteRef;
  employeeGroup: DeliveryEmployeeGroupRef;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
  response?: unknown;
};

function unwrapPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const envelope = payload as ApiMutationEnvelope<unknown>;
  if (envelope.data !== undefined && envelope.data !== null) return envelope.data;
  if (envelope.response !== undefined && envelope.response !== null) return envelope.response;
  return payload;
}

function unwrapArray(payload: unknown): unknown[] {
  const value = unwrapPayload(payload);
  return Array.isArray(value) ? value : [];
}

const DELIVERY_PACKAGE_ACTION = "delivery-pkgs";
const CONDUCE_STATUS_NAMES = new Set(["CONDUCE"]);

type DeliveryReferenceOptions = {
  containers: DeliveryContainerRef[];
  employeeGroups: DeliveryEmployeeGroupRef[];
};

function readNumericId(value: unknown): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeContainerRef(raw: unknown): DeliveryContainerRef | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as ApiRef;
  const id = readNumericId(item.id);
  if (id == null || id <= 0) return null;

  return {
    id,
    name: String(item.name ?? "").trim(),
    containerNumber: String(item.containerNumber ?? "").trim(),
  };
}

function normalizeEmployeeGroupRef(raw: unknown): DeliveryEmployeeGroupRef | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as ApiEmployeeGroupRef;
  const id = String(item.id ?? "").trim();
  const name = String(item.name ?? "").trim();
  if (!id && !name) return null;

  return { id, name };
}

function normalizeDelivery(raw: unknown): Delivery | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiDelivery;
  const id = readNumericId(item.id);
  if (id == null || id <= 0) return null;

  return {
    id,
    name: String(item.name ?? "").trim(),
    date: String(item.date ?? "").trim(),
    container: normalizeContainerRef(item.container),
    employeeGroup: normalizeEmployeeGroupRef(item.employeeGroup),
    createdAt: String(item.createdAt ?? "").trim(),
    updatedAt: String(item.updatedAt ?? "").trim(),
  };
}

function normalizePaginatedDeliveries(
  payload: PaginatedApiEnvelope<unknown[]>,
  context: { isFiltered?: boolean } = {},
): PaginatedResult<Delivery> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeDelivery).filter((delivery): delivery is Delivery => delivery != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: resolvePaginatedListTotal(payload, items.length, context),
  };
}

function hasDeliveryListFilters(params: DeliveryListParams): boolean {
  return hasResourceListFilters({
    search: params.search,
    filterRows: params.filterRows,
    tableFilterFields: DELIVERY_TABLE_FILTER_FIELDS,
  });
}

function buildDeliverySearchBody(params: DeliveryListParams) {
  return buildStripeStyleSearchBody({
    sort: params.sort ?? DEFAULT_DELIVERY_LIST_PARAMS.sort,
    filterGroups: buildResourceSearchFilterGroups({
      search: params.search,
      barOrSearchFields: DELIVERY_BAR_OR_SEARCH_FIELDS,
      filterRows: params.filterRows,
      tableFilterFields: DELIVERY_TABLE_FILTER_FIELDS,
      expandNode: expandDeliveryFilterNode,
    }),
  });
}

function buildDeliveriesQuery(params: DeliveryListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_DELIVERY_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_DELIVERY_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_DELIVERY_LIST_PARAMS.sort,
  });
}

function parseDeliveryPathId(deliveryId: string | number): number {
  const numericId = readNumericId(deliveryId);
  if (numericId == null || numericId <= 0) {
    throw new Error("Invalid delivery ID.");
  }
  return numericId;
}

function assertMutationSuccess(response: ApiMutationEnvelope<unknown>, fallbackMessage: string) {
  if (response.success === false) {
    throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
  }
}

function findContainer(id: string, containers: DeliveryContainerRef[]): DeliveryContainerRef {
  const numericId = parseDeliveryPathId(id);
  const container = containers.find((entry) => entry.id === numericId);
  if (!container) throw new Error("Select a valid container.");
  return container;
}

function findEmployeeGroup(
  id: string,
  employeeGroups: DeliveryEmployeeGroupRef[],
): DeliveryEmployeeGroupRef {
  const trimmed = id.trim();
  const group = employeeGroups.find((entry) => entry.id === trimmed);
  if (!group) throw new Error("Select a valid employee group.");
  return group;
}

function toContainerWriteRef(container: DeliveryContainerRef): ApiDeliveryContainerWriteRef {
  return { id: container.id, name: container.name };
}

function validateDeliveryCreateValues(values: DeliveryFormValues): void {
  if (!values.date.trim()) {
    throw new Error("Delivery date is required.");
  }

  if (!values.containerId.trim()) {
    throw new Error("Container is required.");
  }

  if (!values.employeeGroupId.trim()) {
    throw new Error("Employee group is required.");
  }
}

function buildDeliveryCreatePayload(
  values: DeliveryFormValues,
  references: DeliveryReferenceOptions,
): ApiDeliveryCreatePayload {
  validateDeliveryCreateValues(values);

  return {
    date: toApiDate(values.date),
    container: toContainerWriteRef(findContainer(values.containerId, references.containers)),
    employeeGroup: findEmployeeGroup(values.employeeGroupId, references.employeeGroups),
  };
}

function buildDeliveryUpdatePayload(
  values: DeliveryFormValues,
  references: DeliveryReferenceOptions,
  deliveryId: number,
): ApiDeliveryUpdatePayload {
  validateDeliveryFormValues(values);

  return {
    id: deliveryId,
    name: values.name.trim(),
    date: toApiDate(values.date),
    container: toContainerWriteRef(findContainer(values.containerId, references.containers)),
    employeeGroup: findEmployeeGroup(values.employeeGroupId, references.employeeGroups),
  };
}

function extractDeliveryFromMutationResponse(data: unknown): Delivery | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeDelivery(data);
  }
  return null;
}

function extractMutationId(response: ApiMutationEnvelope<unknown>): number | null {
  const data = response.data;
  const directId = readNumericId(data);
  if (directId != null && directId > 0) return directId;

  const delivery = extractDeliveryFromMutationResponse(data);
  return delivery?.id ?? null;
}

async function resolveCreatedDelivery(
  values: DeliveryFormValues,
  response: ApiMutationEnvelope<unknown>,
): Promise<Delivery> {
  const id = extractMutationId(response);
  if (id) return fetchDeliveryById(id);

  const delivery = extractDeliveryFromMutationResponse(response.data);
  if (delivery) return delivery;

  const matches = await fetchDeliveries({
    page: 1,
    limit: 1,
    sort: "createdAt:desc",
  });
  const match = matches.items[0];
  if (match) return match;

  throw new Error(response.message?.trim() || response.error?.trim() || "Unable to create delivery.");
}

function normalizeBarcode(raw: unknown): DeliveryBarcode | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiBarcode;
  const id = readNumericId(item.id);
  if (id == null || id <= 0) return null;

  const invoiceId = item.invoice?.id ?? item.invoiceId;
  const invoiceNumber = item.invoice?.number ?? item.invoiceNumber;

  return {
    id,
    number: String(item.number ?? "").trim(),
    scanDate: String(item.scanDate ?? item.createdAt ?? "").trim(),
    status: item.status ? { id: item.status.id, name: String(item.status.name ?? "").trim() } : null,
    container: normalizeContainerRef(item.container),
    delivery:
      item.delivery && readNumericId(item.delivery.id)
        ? { id: readNumericId(item.delivery.id)!, name: String(item.delivery.name ?? "").trim() }
        : null,
    invoice: invoiceId ? { id: String(invoiceId), number: String(invoiceNumber ?? invoiceId) } : null,
    lineItemName: String(item.lineItemName ?? item.name ?? "").trim(),
    quantity: Number(item.quantity ?? 1),
  };
}

function normalizeBarcodeList(payload: PaginatedApiEnvelope<unknown[]>): DeliveryBarcode[] {
  return Array.isArray(payload.data)
    ? payload.data.map(normalizeBarcode).filter((barcode): barcode is DeliveryBarcode => barcode != null)
    : [];
}

export async function fetchDeliveries(params: DeliveryListParams = {}): Promise<PaginatedResult<Delivery>> {
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.DELIVERIES,
    page: params.page ?? DEFAULT_DELIVERY_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_DELIVERY_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasDeliveryListFilters(params),
    buildGetQuery: () => buildDeliveriesQuery(params),
    buildSearchBody: () => buildDeliverySearchBody(params),
    normalize: normalizePaginatedDeliveries,
  });
}

export async function fetchDeliveryById(deliveryId: string | number): Promise<Delivery> {
  const numericId = parseDeliveryPathId(deliveryId);
  const response = await apiClient.get<ApiDelivery | PaginatedApiEnvelope<ApiDelivery>>(
    `${API_ENDPOINTS.DELIVERIES}/${numericId}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiDelivery>).data
      : response;

  const delivery = normalizeDelivery(raw);
  if (!delivery) {
    throw new Error("Delivery not found.");
  }

  return delivery;
}

export async function createDelivery(
  values: DeliveryFormValues,
  references: DeliveryReferenceOptions,
): Promise<Delivery> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.DELIVERIES,
    buildDeliveryCreatePayload(values, references),
  );

  assertMutationSuccess(response, "Unable to create delivery.");
  return resolveCreatedDelivery(values, response);
}

export async function updateDelivery(
  deliveryId: string | number,
  values: DeliveryFormValues,
  references: DeliveryReferenceOptions,
): Promise<Delivery> {
  const numericId = parseDeliveryPathId(deliveryId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.DELIVERIES}/${numericId}`,
    buildDeliveryUpdatePayload(values, references, numericId),
  );

  assertMutationSuccess(response, "Unable to update delivery.");
  return extractDeliveryFromMutationResponse(response.data) ?? fetchDeliveryById(numericId);
}

export async function deleteDelivery(deliveryId: string | number): Promise<void> {
  const numericId = parseDeliveryPathId(deliveryId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.DELIVERIES}/${numericId}`,
  );

  assertMutationSuccess(response, "Unable to delete delivery.");
}

export async function deleteDeliveries(deliveryIds: Array<string | number>): Promise<void> {
  await Promise.all(deliveryIds.map((deliveryId) => deleteDelivery(deliveryId)));
}

export async function fetchDeliveryBarcodes(deliveryId: string | number): Promise<DeliveryBarcode[]> {
  const numericId = parseDeliveryPathId(deliveryId);
  const response = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.BARCODES}/search?page=1&limit=500&offset=0`,
    buildStripeStyleSearchBody({
      sort: "createdAt:desc",
      filterGroups: [
        {
          operator: "and",
          filters: [{ field: "delivery.id", operator: "eq", value: numericId }],
        },
      ],
    }),
  );

  return normalizeBarcodeList(response);
}

function normalizePackageStatus(raw: unknown): DeliveryPackageStatusRef {
  if (!raw || typeof raw !== "object") return { name: "" };
  const item = raw as { id?: number; name?: string; prevStatus?: string };
  return {
    id: readNumericId(item.id),
    name: String(item.name ?? "").trim(),
    prevStatus: String(item.prevStatus ?? "").trim() || undefined,
  };
}

function normalizePackageContainer(raw: unknown): DeliveryPackageContainerRef {
  if (!raw || typeof raw !== "object") return { id: 0, name: "" };
  const item = raw as ApiRef;
  return {
    id: readNumericId(item.id) ?? 0,
    name: String(item.name ?? "").trim(),
    containerNumber: String(item.containerNumber ?? "").trim() || undefined,
  };
}

function normalizePackageBarcode(raw: unknown): DeliveryPackageBarcode | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as ApiBarcode;
  const id = readNumericId(item.id);
  const number = String(item.number ?? "").trim();
  if (id == null || id <= 0 || !number) return null;

  const invoiceId = item.invoice?.id ?? item.invoiceId;
  const invoiceNumber = item.invoice?.number ?? item.invoiceNumber;

  return {
    id,
    number,
    status: normalizePackageStatus(item.status),
    container: normalizePackageContainer(item.container),
    delivery:
      item.delivery && readNumericId(item.delivery.id)
        ? { id: readNumericId(item.delivery.id)!, name: String(item.delivery.name ?? "").trim() }
        : null,
    invoice: invoiceId
      ? { id: String(invoiceId), number: String(invoiceNumber ?? invoiceId) }
      : null,
    scanDate: String(item.scanDate ?? item.createdAt ?? "").trim() || undefined,
  };
}

function normalizePackageLineItem(raw: unknown): DeliveryPackageLineItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as {
    id?: string | number;
    name?: string;
    invoice?: string;
    quantity?: number;
    labels?: number;
    price?: number;
    total?: number;
    barcodes?: unknown[];
  };

  const id = String(item.id ?? item.name ?? "").trim();
  const name = String(item.name ?? "").trim();
  if (!id && !name) return null;

  const barcodes = Array.isArray(item.barcodes)
    ? item.barcodes
        .map(normalizePackageBarcode)
        .filter((barcode): barcode is DeliveryPackageBarcode => barcode != null)
    : [];

  return {
    id: id || name,
    name: name || id,
    invoiceNumber: String(item.invoice ?? "").trim(),
    quantity: Number(item.quantity ?? 0),
    labels: Number(item.labels ?? barcodes.length),
    price: Number(item.price ?? 0),
    total: Number(item.total ?? 0),
    barcodes,
  };
}

function normalizePackageUpdateResult(raw: unknown): DeliveryPackageUpdateResult | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as {
    number?: string;
    date?: string;
    newStatus?: string;
    prevStatus?: string;
    containerNumber?: string;
    deliveryNumber?: string;
    message?: string;
    hasError?: boolean;
  };
  const number = String(item.number ?? "").trim();
  if (!number) return null;

  return {
    number,
    date: String(item.date ?? "").trim() || undefined,
    newStatus: String(item.newStatus ?? "").trim() || undefined,
    prevStatus: String(item.prevStatus ?? "").trim() || undefined,
    containerNumber: String(item.containerNumber ?? "").trim() || undefined,
    deliveryNumber: String(item.deliveryNumber ?? "").trim() || undefined,
    message: String(item.message ?? "").trim(),
    hasError: Boolean(item.hasError),
  };
}

export async function fetchInvoiceDetailLabels(invoiceIds: string[]): Promise<DeliveryPackageLineItem[]> {
  const ids = invoiceIds.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    throw new Error("Select at least one invoice.");
  }

  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.INVOICE_DETAIL_LABELS,
    { invoiceIds: ids },
  );

  assertMutationSuccess(response, "Unable to load invoice packages.");
  return unwrapArray(response)
    .map(normalizePackageLineItem)
    .filter((line): line is DeliveryPackageLineItem => line != null);
}

export async function fetchDeliveryBarcodeStatuses(): Promise<DeliveryPackageStatusRef[]> {
  const response = await apiClient.get<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.INVOICE_DETAIL_BARCODE_STATUSES,
  );

  return unwrapArray(response)
    .map(normalizePackageStatus)
    .filter((status) => status.name);
}

function resolveConduceStatus(statuses: DeliveryPackageStatusRef[]): DeliveryPackageStatusRef {
  const match =
    statuses.find((status) => status.id === 6) ??
    statuses.find((status) => CONDUCE_STATUS_NAMES.has(status.name.toUpperCase()));

  if (!match?.name) {
    throw new Error("CONDUCE status is not available in the barcode status list.");
  }

  return match;
}

export async function addPackagesToDelivery(input: {
  delivery: Delivery;
  barcodes: DeliveryPackageBarcode[];
}): Promise<DeliveryPackageUpdateResult[]> {
  const { delivery, barcodes } = input;

  if (!delivery.container) {
    throw new Error("Delivery must have a container before packages can be added.");
  }

  if (barcodes.length === 0) {
    throw new Error("Select at least one package to add.");
  }

  const conduceStatus = resolveConduceStatus(await fetchDeliveryBarcodeStatuses());

  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.INVOICE_DETAIL_BARCODE,
    {
      action: DELIVERY_PACKAGE_ACTION,
      barcodes: barcodes.map((barcode) => ({
        number: barcode.number,
        currentStatus: barcode.status,
        nextStatus: { id: conduceStatus.id, name: conduceStatus.name },
        prevStatus: conduceStatus.prevStatus ?? barcode.status.prevStatus ?? "",
        container: barcode.container,
        delivery: barcode.delivery,
        invoice: barcode.invoice,
      })),
      status: { id: conduceStatus.id, name: conduceStatus.name },
      container: { id: 0, name: "" },
      delivery: { id: delivery.id, name: delivery.name },
    },
  );

  assertMutationSuccess(response, "Unable to add packages to delivery.");

  const results = unwrapArray(response)
    .map(normalizePackageUpdateResult)
    .filter((result): result is DeliveryPackageUpdateResult => result != null);

  if (results.length === 0 && barcodes.length > 0) {
    return barcodes.map((barcode) => ({
      number: barcode.number,
      message: "Package added to delivery.",
      hasError: false,
    }));
  }

  return results;
}
