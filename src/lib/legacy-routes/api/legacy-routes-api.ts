import { apiClient } from "@/lib/api/client";
import { fetchCatalogPage, type CatalogPageParams } from "@/lib/api/fetch-catalog-page";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { unwrapApiData, type ApiSuccessEnvelope } from "@/lib/auth/utils/api-response";
import type { PaginatedResult } from "@/lib/api/types";
import {
  LEGACY_ROUTE_BAR_OR_SEARCH_FIELDS,
  LEGACY_ROUTE_TABLE_FILTER_FIELDS,
  expandLegacyRouteFilterNode,
} from "@/lib/legacy-routes/filter-fields";
import {
  getLegacyRoutesMockClient,
  isLegacyRoutesMockEnabled,
  type LegacyRoutesClient,
} from "@/lib/legacy-routes/api/legacy-routes-mock";
import {
  legacyRouteFormSchema,
  legacyRoutePayloadSchema,
  legacyRouteSchema,
} from "@/lib/legacy-routes/schemas/legacy-route.schema";
import { toLegacyRoutePayload, type LegacyRoute, type LegacyRouteFormValues } from "@/lib/legacy-routes/types";

const endpoint = API_ENDPOINTS.LEGACY_ROUTES;

function client(): LegacyRoutesClient {
  return isLegacyRoutesMockEnabled() ? getLegacyRoutesMockClient() : apiClient;
}

function buildPayload(values: LegacyRouteFormValues) {
  return legacyRoutePayloadSchema.parse(toLegacyRoutePayload(legacyRouteFormSchema.parse(values)));
}

function detailPath(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid legacy route ID.");
  return `${endpoint}/${id}`;
}

export async function fetchLegacyRoute(id: number): Promise<LegacyRoute> {
  const response = await client().get<ApiSuccessEnvelope<unknown>>(detailPath(id));
  assertMutationSuccess(response, "Unable to load legacy route.");
  return legacyRouteSchema.parse(unwrapApiData(response));
}

export async function createLegacyRoute(values: LegacyRouteFormValues): Promise<LegacyRoute> {
  const response = await client().post<ApiSuccessEnvelope<unknown>>(endpoint, buildPayload(values));
  assertMutationSuccess(response, "Unable to create legacy route.");
  return legacyRouteSchema.parse(unwrapApiData(response));
}

export async function updateLegacyRoute(id: number, values: LegacyRouteFormValues): Promise<LegacyRoute> {
  const path = detailPath(id);
  const response = await client().put<ApiSuccessEnvelope<unknown>>(path, buildPayload(values));
  assertMutationSuccess(response, "Unable to update legacy route.");
  return legacyRouteSchema.parse(unwrapApiData(response));
}

export async function deleteLegacyRoute(id: number): Promise<void> {
  const response = await client().delete<ApiSuccessEnvelope<unknown>>(detailPath(id));
  assertMutationSuccess(response, "Unable to delete legacy route.");
}

/** Every legacy route (all pages), for dropdowns such as the appointments filter. */
export async function fetchAllLegacyRoutes(): Promise<LegacyRoute[]> {
  const items: LegacyRoute[] = [];
  for (let page = 1; ; page++) {
    const result = await fetchLegacyRoutesPage({ page, limit: 200, sort: "name:asc" });
    items.push(...result.items);
    if (!result.items.length || items.length >= result.total) return items;
  }
}

/** One server page for the directory table (search + filters applied by the API). */
export function fetchLegacyRoutesPage(params: CatalogPageParams): Promise<PaginatedResult<LegacyRoute>> {
  return fetchCatalogPage(
    {
      endpoint,
      client: client(),
      barOrSearchFields: LEGACY_ROUTE_BAR_OR_SEARCH_FIELDS,
      filterFields: LEGACY_ROUTE_TABLE_FILTER_FIELDS,
      expandNode: expandLegacyRouteFilterNode,
      parseRows: (data) => legacyRouteSchema.array().parse(Array.isArray(data) ? data : []),
    },
    params,
  );
}
