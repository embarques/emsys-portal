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
  DEFAULT_TRUCK_LIST_PARAMS,
  validateTruckFormValues,
  type Truck,
  type TruckFormValues,
  type TruckListParams,
} from "@/lib/trucks/types";

const TRUCK_LIST_SEARCH_FIELD = "name";

type ApiTruck = {
  id?: string;
  truckId?: string;
  name?: string;
  vin?: string;
  year?: number;
  fuelType?: string;
  branch?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
};

/** POST/PUT /trucks — Swagger truck payload */
type ApiTruckWritePayload = {
  truckId: string;
  name: string;
  vin: string;
  year: number;
  fuelType: string;
  branch: string;
  id?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
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

function normalizeTruck(raw: unknown): Truck | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiTruck;
  const id = readStringId(item.id);
  if (!id) return null;

  return {
    id,
    truckId: String(item.truckId ?? "").trim(),
    name: String(item.name ?? "").trim(),
    vin: String(item.vin ?? "").trim().toUpperCase(),
    year: Number(item.year ?? 0),
    fuelType: String(item.fuelType ?? "").trim(),
    branch: String(item.branch ?? "").trim(),
    createdAt: String(item.createdAt ?? "").trim(),
    createdBy: String(item.createdBy ?? "").trim(),
    updatedAt: String(item.updatedAt ?? "").trim(),
  };
}

function normalizePaginatedTrucks(payload: PaginatedApiEnvelope<unknown[]>): PaginatedResult<Truck> {
  const items = Array.isArray(payload.data)
    ? payload.data.map(normalizeTruck).filter((truck): truck is Truck => truck != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: payload.total ?? items.length,
  };
}

function buildTruckSearchFilters(params: TruckListParams): ApiSearchFilter[] {
  const filters: ApiSearchFilter[] = [];

  if (params.search?.value.trim()) {
    const textFilter = createTextSearchFilter(
      resolveSearchField(params.search, TRUCK_LIST_SEARCH_FIELD),
      params.search.value,
      resolveSearchOperator(params.search),
    );
    if (textFilter) {
      filters.push(textFilter);
    }
  }

  if (params.fuelType && params.fuelType !== "all") {
    filters.push({ field: "fuelType", operator: "eq", value: params.fuelType });
  }

  if (params.branch && params.branch !== "all") {
    filters.push({ field: "branch", operator: "eq", value: params.branch });
  }

  return filters;
}

function shouldUseTruckSearch(params: TruckListParams): boolean {
  return (
    hasListTextSearch(params.search) ||
    Boolean(params.fuelType && params.fuelType !== "all") ||
    Boolean(params.branch && params.branch !== "all")
  );
}

function buildTrucksQuery(params: TruckListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_TRUCK_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_TRUCK_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_TRUCK_LIST_PARAMS.sort,
  });
}

function buildTruckSearchBody(params: TruckListParams) {
  return buildApiSearchBody({
    page: params.page ?? DEFAULT_TRUCK_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_TRUCK_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_TRUCK_LIST_PARAMS.sort,
    filters: buildTruckSearchFilters(params),
  });
}

function buildTruckWritePayload(
  values: TruckFormValues,
  options: { recordId?: string } = {},
): ApiTruckWritePayload {
  validateTruckFormValues(values);

  const yearValue = values.year.trim();
  const payload: ApiTruckWritePayload = {
    truckId: values.truckId.trim(),
    name: values.name.trim(),
    vin: values.vin.trim().toUpperCase(),
    year: yearValue ? Number(yearValue) : 0,
    fuelType: values.fuelType.trim(),
    branch: values.branch.trim(),
  };

  if (options.recordId) {
    payload.id = options.recordId;

    if (values.createdAt.trim()) {
      payload.createdAt = values.createdAt.trim();
    }

    if (values.createdBy.trim()) {
      payload.createdBy = values.createdBy.trim();
    }

    payload.updatedAt = new Date().toISOString();
  }

  return payload;
}

function assertMutationSuccess(response: ApiMutationEnvelope<unknown>, fallbackMessage: string) {
  if (response.success === false) {
    throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
  }
}

function extractTruckFromMutationResponse(data: unknown): Truck | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeTruck(data);
  }
  return null;
}

function extractCreatedTruckId(response: ApiMutationEnvelope<unknown>): string | null {
  const data = response.data;

  if (typeof data === "string") {
    const id = data.trim();
    return id || null;
  }

  const truck = extractTruckFromMutationResponse(data);
  return truck?.id ?? null;
}

function parseTruckPathId(truckId: string): string {
  const id = truckId.trim();
  if (!id) {
    throw new Error("Invalid truck ID.");
  }
  return id;
}

async function resolveCreatedTruck(
  values: TruckFormValues,
  response: ApiMutationEnvelope<unknown>,
): Promise<Truck> {
  const createdId = extractCreatedTruckId(response);
  if (createdId) {
    return fetchTruckById(createdId);
  }

  const truck = extractTruckFromMutationResponse(response.data);
  if (truck) {
    return truck;
  }

  const truckCode = values.truckId.trim();
  if (truckCode) {
    const matches = await fetchTrucks({
      page: 1,
      limit: 1,
      search: { field: "truckId", operator: "eq", value: truckCode },
    });

    const matchedTruck = matches.items[0];
    if (matchedTruck) {
      return matchedTruck;
    }
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to create truck.");
}

export async function fetchTrucks(params: TruckListParams = {}): Promise<PaginatedResult<Truck>> {
  if (shouldUseTruckSearch(params)) {
    const response = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
      `${API_ENDPOINTS.TRUCKS}/search`,
      buildTruckSearchBody(params),
    );

    return normalizePaginatedTrucks(response);
  }

  const query = buildTrucksQuery(params);
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.TRUCKS}?${query}`,
  );

  return normalizePaginatedTrucks(response);
}

export async function fetchTruckById(truckId: string): Promise<Truck> {
  const id = parseTruckPathId(truckId);
  const response = await apiClient.get<ApiTruck | PaginatedApiEnvelope<ApiTruck>>(
    `${API_ENDPOINTS.TRUCKS}/${id}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiTruck>).data
      : response;

  const truck = normalizeTruck(raw);
  if (!truck) {
    throw new Error("Truck not found.");
  }

  return truck;
}

export async function createTruck(values: TruckFormValues): Promise<Truck> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.TRUCKS,
    buildTruckWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create truck.");

  return resolveCreatedTruck(values, response);
}

export async function updateTruck(truckId: string, values: TruckFormValues): Promise<Truck> {
  const id = parseTruckPathId(truckId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.TRUCKS}/${id}`,
    buildTruckWritePayload(values, { recordId: id }),
  );

  assertMutationSuccess(response, "Unable to update truck.");

  const updatedTruck = extractTruckFromMutationResponse(response.data);
  if (updatedTruck) {
    return updatedTruck;
  }

  return fetchTruckById(id);
}

export async function deleteTruck(truckId: string): Promise<void> {
  const id = parseTruckPathId(truckId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.TRUCKS}/${id}`,
  );

  assertMutationSuccess(response, "Unable to delete truck.");
}

export async function deleteTrucks(truckIds: string[]): Promise<void> {
  await Promise.all(truckIds.map((truckId) => deleteTruck(truckId)));
}
