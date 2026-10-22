import { apiClient } from "@/lib/api/client";
import { fetchCatalogPage, type CatalogPageParams } from "@/lib/api/fetch-catalog-page";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { unwrapApiData, type ApiSuccessEnvelope } from "@/lib/auth/utils/api-response";
import type { PaginatedResult } from "@/lib/api/types";
import {
  PREDEFINED_ROUTE_BAR_OR_SEARCH_FIELDS,
  PREDEFINED_ROUTE_TABLE_FILTER_FIELDS,
  expandPredefinedRouteFilterNode,
} from "@/lib/predefined-routes/filter-fields";
import {
  predefinedRouteFormSchema,
  predefinedRoutePayloadSchema,
  predefinedRouteSchema,
} from "@/lib/predefined-routes/schemas/predefined-route.schema";
import { toPredefinedRoutePayload, type PredefinedRoute, type PredefinedRouteFormValues } from "@/lib/predefined-routes/types";

const endpoint = API_ENDPOINTS.PREDEFINED_ROUTES;

function client() { return apiClient; }

function buildPayload(values: PredefinedRouteFormValues) {
  return predefinedRoutePayloadSchema.parse(toPredefinedRoutePayload(predefinedRouteFormSchema.parse(values)));
}

function detailPath(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid predefined route ID.");
  return `${endpoint}/${id}`;
}

export async function fetchPredefinedRoute(id: number): Promise<PredefinedRoute> {
  const response = await client().get<ApiSuccessEnvelope<unknown>>(detailPath(id));
  assertMutationSuccess(response, "Unable to load predefined route.");
  return predefinedRouteSchema.parse(unwrapApiData(response));
}

export async function createPredefinedRoute(values: PredefinedRouteFormValues): Promise<PredefinedRoute> {
  const response = await client().post<ApiSuccessEnvelope<unknown>>(endpoint, buildPayload(values));
  assertMutationSuccess(response, "Unable to create predefined route.");
  return predefinedRouteSchema.parse(unwrapApiData(response));
}

export async function updatePredefinedRoute(id: number, values: PredefinedRouteFormValues): Promise<PredefinedRoute> {
  const path = detailPath(id);
  const response = await client().put<ApiSuccessEnvelope<unknown>>(path, buildPayload(values));
  assertMutationSuccess(response, "Unable to update predefined route.");
  return predefinedRouteSchema.parse(unwrapApiData(response));
}

export async function deletePredefinedRoute(id: number): Promise<void> {
  const response = await client().delete<ApiSuccessEnvelope<unknown>>(detailPath(id));
  assertMutationSuccess(response, "Unable to delete predefined route.");
}

/** Every predefined route (all pages), for dropdowns such as the appointments filter. */
export async function fetchAllPredefinedRoutes(signal?: AbortSignal): Promise<PredefinedRoute[]> {
  const items: PredefinedRoute[] = [];
  for (let page = 1; ; page++) {
    signal?.throwIfAborted();
    if (page > 100) throw new Error("Predefined route catalog exceeds the supported lookup size.");
    const result = await fetchPredefinedRoutesPage({ page, limit: 200, sort: "name:asc" }, signal);
    signal?.throwIfAborted();
    items.push(...result.items);
    if (!result.items.length || items.length >= result.total) return items;
  }
}

/** One server page for the directory table (search + filters applied by the API). */
export function fetchPredefinedRoutesPage(params: CatalogPageParams, signal?: AbortSignal): Promise<PaginatedResult<PredefinedRoute>> {
  return fetchCatalogPage(
    {
      endpoint,
      client: signal ? {
        get: (url, config) => apiClient.get(url, { ...config, signal }),
        post: (url, data, config) => apiClient.post(url, data, { ...config, signal }),
      } : client(),
      barOrSearchFields: PREDEFINED_ROUTE_BAR_OR_SEARCH_FIELDS,
      filterFields: PREDEFINED_ROUTE_TABLE_FILTER_FIELDS,
      expandNode: expandPredefinedRouteFilterNode,
      parseRows: (data) => predefinedRouteSchema.array().parse(Array.isArray(data) ? data : []),
    },
    params,
  );
}
