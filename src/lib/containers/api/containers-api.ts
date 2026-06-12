import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { buildApiListQuery } from "@/lib/api/list-query";
import {
  buildApiSearchBody,
  createTextSearchFilter,
  hasListTextSearch,
  resolveSearchField,
  resolveSearchOperator,
  type ApiSearchFilter,
} from "@/lib/api/search-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import {
  DEFAULT_CONTAINER_LIST_PARAMS,
  toApiDate,
  validateContainerFormValues,
  type Container,
  type ContainerFormValues,
  type ContainerListParams,
} from "@/lib/containers/types";

const CONTAINER_LIST_SEARCH_FIELD = "name";

type ApiContainer = {
  id?: number;
  name?: string;
  containerNumber?: string;
  booking?: string;
  sealNumber?: string;
  seal?: string;
  broker?: string;
  company?: string;
  cost?: number;
  departureDate?: string;
  arrivalDate?: string;
  barcodeSequence?: number;
  deliverySequence?: number;
  createdAt?: string;
  updatedAt?: string;
};

/** POST/PUT /containers — see API_PAYLOADS.md */
type ApiContainerWritePayload = {
  name: string;
  booking: string;
  containerNumber?: string;
  sealNumber?: string;
  broker?: string;
  company?: string;
  cost?: number;
  departureDate?: string;
  arrivalDate?: string;
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

function normalizeContainer(raw: unknown): Container | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiContainer;
  const id = readNumericId(item.id);
  if (id == null || id <= 0) return null;

  return {
    id,
    name: String(item.name ?? "").trim(),
    containerNumber: String(item.containerNumber ?? "").trim().toUpperCase(),
    booking: String(item.booking ?? "").trim(),
    sealNumber: String(item.sealNumber ?? item.seal ?? "").trim(),
    seal: String(item.seal ?? item.sealNumber ?? "").trim(),
    broker: String(item.broker ?? "").trim(),
    company: String(item.company ?? "").trim(),
    cost: Number(item.cost ?? 0),
    departureDate: String(item.departureDate ?? "").trim(),
    arrivalDate: String(item.arrivalDate ?? "").trim(),
    barcodeSequence: Number(item.barcodeSequence ?? 0),
    deliverySequence: Number(item.deliverySequence ?? 0),
    createdAt: String(item.createdAt ?? "").trim(),
    updatedAt: String(item.updatedAt ?? "").trim(),
  };
}

function normalizePaginatedContainers(payload: PaginatedApiEnvelope<unknown[]>): PaginatedResult<Container> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeContainer).filter((container): container is Container => container != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: payload.total ?? items.length,
  };
}

function buildContainerSearchFilters(params: ContainerListParams): ApiSearchFilter[] {
  const filters: ApiSearchFilter[] = [];

  if (params.search?.value.trim()) {
    const textFilter = createTextSearchFilter(
      resolveSearchField(params.search, CONTAINER_LIST_SEARCH_FIELD),
      params.search.value,
      resolveSearchOperator(params.search),
    );
    if (textFilter) {
      filters.push(textFilter);
    }
  }

  return filters;
}

function buildContainersQuery(params: ContainerListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_CONTAINER_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_CONTAINER_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_CONTAINER_LIST_PARAMS.sort,
  });
}

function buildContainerSearchBody(params: ContainerListParams) {
  return buildApiSearchBody({
    page: params.page ?? DEFAULT_CONTAINER_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_CONTAINER_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_CONTAINER_LIST_PARAMS.sort,
    filters: buildContainerSearchFilters(params),
  });
}

function buildContainerWritePayload(
  values: ContainerFormValues,
  options: { containerId?: number } = {},
): ApiContainerWritePayload {
  validateContainerFormValues(values);

  const containerNumber = values.containerNumber.trim().toUpperCase();
  const sealNumber = values.sealNumber.trim();
  const broker = values.broker.trim();
  const company = values.company.trim();
  const costValue = values.cost.trim();

  const payload: ApiContainerWritePayload = {
    name: values.name.trim(),
    booking: values.booking.trim(),
  };

  if (options.containerId) {
    payload.id = options.containerId;
  }

  if (containerNumber) {
    payload.containerNumber = containerNumber;
  }

  if (sealNumber) {
    payload.sealNumber = sealNumber;
  }

  if (broker) {
    payload.broker = broker;
  }

  if (company) {
    payload.company = company;
  }

  if (costValue) {
    payload.cost = Number(costValue);
  }

  if (values.departureDate.trim()) {
    payload.departureDate = toApiDate(values.departureDate);
  }

  if (values.arrivalDate.trim()) {
    payload.arrivalDate = toApiDate(values.arrivalDate);
  }

  return payload;
}

function assertMutationSuccess(response: ApiMutationEnvelope<unknown>, fallbackMessage: string) {
  if (response.success === false) {
    throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
  }
}

function extractContainerFromMutationResponse(data: unknown): Container | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeContainer(data);
  }
  return null;
}

function extractCreatedContainerId(response: ApiMutationEnvelope<unknown>): number | null {
  const data = response.data;

  if (typeof data === "number" && Number.isFinite(data)) {
    return data;
  }

  if (typeof data === "string") {
    const id = Number(data.trim());
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  const container = extractContainerFromMutationResponse(data);
  return container?.id ?? null;
}

function parseContainerPathId(containerId: string | number): number {
  const numericId = readNumericId(containerId);
  if (numericId == null || numericId <= 0) {
    throw new Error("Invalid container ID.");
  }
  return numericId;
}

async function resolveCreatedContainer(
  values: ContainerFormValues,
  response: ApiMutationEnvelope<unknown>,
): Promise<Container> {
  const createdId = extractCreatedContainerId(response);
  if (createdId) {
    return fetchContainerById(createdId);
  }

  const container = extractContainerFromMutationResponse(response.data);
  if (container) {
    return container;
  }

  const name = values.name.trim();
  if (name) {
    const matches = await fetchContainers({
      page: 1,
      limit: 1,
      search: { field: "name", operator: "eq", value: name },
    });

    const matchedContainer = matches.items[0];
    if (matchedContainer) {
      return matchedContainer;
    }
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to create container.");
}

export async function fetchContainers(params: ContainerListParams = {}): Promise<PaginatedResult<Container>> {
  if (hasListTextSearch(params.search)) {
    const response = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
      `${API_ENDPOINTS.CONTAINERS}/search`,
      buildContainerSearchBody(params),
    );

    return normalizePaginatedContainers(response);
  }

  const query = buildContainersQuery(params);
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.CONTAINERS}?${query}`,
  );

  return normalizePaginatedContainers(response);
}

export async function fetchContainerById(containerId: string | number): Promise<Container> {
  const numericId = parseContainerPathId(containerId);
  const response = await apiClient.get<ApiContainer | PaginatedApiEnvelope<ApiContainer>>(
    `${API_ENDPOINTS.CONTAINERS}/${numericId}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiContainer>).data
      : response;

  const container = normalizeContainer(raw);
  if (!container) {
    throw new Error("Container not found.");
  }

  return container;
}

export async function createContainer(values: ContainerFormValues): Promise<Container> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.CONTAINERS,
    buildContainerWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create container.");

  return resolveCreatedContainer(values, response);
}

export async function updateContainer(
  containerId: string | number,
  values: ContainerFormValues,
): Promise<Container> {
  const numericId = parseContainerPathId(containerId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.CONTAINERS}/${numericId}`,
    buildContainerWritePayload(values, { containerId: numericId }),
  );

  assertMutationSuccess(response, "Unable to update container.");

  const updatedContainer = extractContainerFromMutationResponse(response.data);
  if (updatedContainer) {
    return updatedContainer;
  }

  return fetchContainerById(numericId);
}

export async function deleteContainer(containerId: string | number): Promise<void> {
  const numericId = parseContainerPathId(containerId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.CONTAINERS}/${numericId}`,
  );

  assertMutationSuccess(response, "Unable to delete container.");
}

export async function deleteContainers(containerIds: Array<string | number>): Promise<void> {
  await Promise.all(containerIds.map((containerId) => deleteContainer(containerId)));
}
