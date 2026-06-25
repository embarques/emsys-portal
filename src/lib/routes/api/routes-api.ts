import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery } from "@/lib/api/list-query";
import {
  buildResourceSearchFilterGroups,
  buildStripeStyleSearchBody,
  hasResourceListFilters,
} from "@/lib/api/search-query";
import { ROUTE_BAR_OR_SEARCH_FIELDS } from "@/lib/routes/search-fields";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import {
  DEFAULT_ROUTE_LIST_PARAMS,
  validateRouteFormValues,
  type RouteCity,
  type RouteFormValues,
  type RouteListParams,
  type RouteRecord,
  type RouteZipRange,
} from "@/lib/routes/types";

type ApiRouteCity = {
  cityName?: string;
  stateCode?: string;
};

type ApiRouteZipRange = {
  start?: string;
  end?: string;
};

type ApiRoute = {
  id?: string;
  name?: string;
  cities?: ApiRouteCity[];
  states?: string[];
  zipCodes?: string[];
  zipRanges?: ApiRouteZipRange[];
  createdAt?: string;
  updatedAt?: string;
};

/** POST/PUT /pickups/route */
type ApiRouteWritePayload = {
  name: string;
  cities: ApiRouteCity[];
  states: string[];
  zipCodes: string[];
  zipRanges: ApiRouteZipRange[];
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

function normalizeCity(raw: ApiRouteCity | undefined): RouteCity | null {
  const cityName = String(raw?.cityName ?? "").trim();
  if (!cityName) return null;
  return {
    cityName,
    stateCode: String(raw?.stateCode ?? "").trim(),
  };
}

function normalizeZipRange(raw: ApiRouteZipRange | undefined): RouteZipRange | null {
  const start = String(raw?.start ?? "").trim();
  const end = String(raw?.end ?? "").trim();
  if (!start && !end) return null;
  return { start, end };
}

function normalizeStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((value) => String(value ?? "").trim()).filter(Boolean);
}

function normalizeRoute(raw: unknown): RouteRecord | null {
  if (!raw || typeof raw !== "object") return null;

  const route = raw as ApiRoute;
  const id = String(route.id ?? "").trim();
  if (!id) return null;

  return {
    routeId: id,
    name: String(route.name ?? "").trim(),
    cities: Array.isArray(route.cities)
      ? route.cities.map(normalizeCity).filter((city): city is RouteCity => city != null)
      : [],
    states: normalizeStringList(route.states),
    zipCodes: normalizeStringList(route.zipCodes),
    zipRanges: Array.isArray(route.zipRanges)
      ? route.zipRanges.map(normalizeZipRange).filter((range): range is RouteZipRange => range != null)
      : [],
    createdAt: String(route.createdAt ?? "").trim(),
    updatedAt: String(route.updatedAt ?? "").trim(),
  };
}

function normalizePaginatedRoutes(payload: PaginatedApiEnvelope<unknown[]>): PaginatedResult<RouteRecord> {
  const routes = Array.isArray(payload.data)
    ? payload.data.map(normalizeRoute).filter((route): route is RouteRecord => route != null)
    : [];

  return {
    items: routes,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? routes.length,
    total: payload.total ?? routes.length,
  };
}

function hasRouteListFilters(params: RouteListParams): boolean {
  return hasResourceListFilters({ search: params.search });
}

function buildRoutesQuery(params: RouteListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_ROUTE_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_ROUTE_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_ROUTE_LIST_PARAMS.sort,
  });
}

function buildRouteSearchBody(params: RouteListParams) {
  return buildStripeStyleSearchBody({
    sort: params.sort ?? DEFAULT_ROUTE_LIST_PARAMS.sort,
    filterGroups: buildResourceSearchFilterGroups({
      search: params.search,
      barOrSearchFields: ROUTE_BAR_OR_SEARCH_FIELDS,
      filterRows: [],
      tableFilterFields: [],
    }),
  });
}

function buildRouteWritePayload(values: RouteFormValues): ApiRouteWritePayload {
  validateRouteFormValues(values);

  const cities: ApiRouteCity[] = values.cities
    .map((city) => ({ cityName: city.cityName.trim(), stateCode: city.stateCode.trim() }))
    .filter((city) => city.cityName.length > 0);

  const states = values.states.map((state) => state.value.trim()).filter(Boolean);
  const zipCodes = values.zipCodes.map((zip) => zip.value.trim()).filter(Boolean);

  const zipRanges: ApiRouteZipRange[] = values.zipRanges
    .map((range) => ({ start: range.start.trim(), end: range.end.trim() }))
    .filter((range) => range.start.length > 0 && range.end.length > 0);

  return {
    name: values.name.trim(),
    cities,
    states,
    zipCodes,
    zipRanges,
  };
}

function assertMutationSuccess(response: ApiMutationEnvelope<unknown>, fallbackMessage: string) {
  if (response.success === false) {
    throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
  }
}

function extractRouteFromMutationResponse(data: unknown): RouteRecord | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeRoute(data);
  }
  return null;
}

function extractCreatedRouteId(response: ApiMutationEnvelope<unknown>): string | null {
  const data = response.data;

  if (typeof data === "string") {
    return data.trim() || null;
  }

  const route = extractRouteFromMutationResponse(data);
  return route ? route.routeId : null;
}

function parseRoutePathId(routeId: string): string {
  const trimmed = routeId.trim();
  if (!trimmed) {
    throw new Error("Invalid route ID.");
  }
  return encodeURIComponent(trimmed);
}

async function resolveCreatedRoute(
  values: RouteFormValues,
  response: ApiMutationEnvelope<unknown>,
): Promise<RouteRecord> {
  const createdId = extractCreatedRouteId(response);
  if (createdId) {
    return fetchRouteById(createdId);
  }

  const route = extractRouteFromMutationResponse(response.data);
  if (route) {
    return route;
  }

  const name = values.name.trim();
  if (name) {
    const matches = await fetchRoutes({
      page: 1,
      limit: 1,
      search: { field: "name", operator: "eq", value: name },
    });

    const matchedRoute = matches.items[0];
    if (matchedRoute) {
      return matchedRoute;
    }
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to create route.");
}

export async function fetchRoutes(params: RouteListParams = {}): Promise<PaginatedResult<RouteRecord>> {
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.PICKUP_ROUTES,
    page: params.page ?? DEFAULT_ROUTE_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_ROUTE_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasRouteListFilters(params),
    buildGetQuery: () => buildRoutesQuery(params),
    buildSearchBody: () => buildRouteSearchBody(params),
    normalize: normalizePaginatedRoutes,
  });
}

export async function fetchRouteById(routeId: string): Promise<RouteRecord> {
  const pathId = parseRoutePathId(routeId);
  const response = await apiClient.get<ApiRoute | PaginatedApiEnvelope<ApiRoute>>(
    `${API_ENDPOINTS.PICKUP_ROUTES}/${pathId}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiRoute>).data
      : response;

  const route = normalizeRoute(raw);
  if (!route) {
    throw new Error("Route not found.");
  }

  return route;
}

export async function createRoute(values: RouteFormValues): Promise<RouteRecord> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.PICKUP_ROUTES,
    buildRouteWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create route.");

  return resolveCreatedRoute(values, response);
}

export async function updateRoute(routeId: string, values: RouteFormValues): Promise<RouteRecord> {
  const pathId = parseRoutePathId(routeId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.PICKUP_ROUTES}/${pathId}`,
    buildRouteWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to update route.");

  const updatedRoute = extractRouteFromMutationResponse(response.data);
  if (updatedRoute) {
    return updatedRoute;
  }

  return fetchRouteById(routeId);
}

export async function deleteRoute(routeId: string): Promise<void> {
  const pathId = parseRoutePathId(routeId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.PICKUP_ROUTES}/${pathId}`,
  );

  assertMutationSuccess(response, "Unable to delete route.");
}

export async function deleteRoutes(routeIds: string[]): Promise<void> {
  await Promise.all(routeIds.map((routeId) => deleteRoute(routeId)));
}
