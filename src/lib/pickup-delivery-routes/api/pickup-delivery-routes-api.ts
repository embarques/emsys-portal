import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery } from "@/lib/api/list-query";
import {
  buildApiSearchPaginationQuery,
  buildStripeStyleSearchBody,
  createOrTextSearchFilterGroup,
  createTextSearchFilter,
  hasListTextSearch,
} from "@/lib/api/search-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { resolvePaginatedListTotal } from "@/lib/api/types";
import type {
  DeliveryRouteWritePayload,
  PickupRouteWritePayload,
} from "@/lib/pickup-delivery-routes/api-schemas";
import {
  assertActiveRouteFormValues,
  DEFAULT_ACTIVE_ROUTE_LIST_PARAMS,
  type ActiveRoute,
  type ActiveRouteFormValues,
  type ActiveRouteListParams,
  type ActiveRouteLookupParams,
  type RouteType,
} from "@/lib/pickup-delivery-routes/types";
import { ROUTES_USE_MOCK_DATA } from "@/lib/route-manager/data-source";
import * as activeRoutesMockApi from "@/lib/pickup-delivery-routes/api/pickup-delivery-routes-mock-api";
import { toRouteDateIso } from "@/lib/route-manager/types";

type ApiUser = {
  id?: number;
  name?: string;
  userName?: string;
  fullName?: string;
};

type ApiRef = {
  id?: string | number;
  name?: string;
  routeId?: string;
};

type ApiEmployeeRef = {
  id?: string | number;
  name?: string;
};

type ApiPickupRoute = {
  id?: string | number;
  name?: string;
  date?: string;
  route?: ApiRef | null;
  driver?: ApiEmployeeRef | null;
  appraiser?: ApiEmployeeRef | null;
  createdAt?: string;
  createdBy?: ApiUser | string | null;
  updatedAt?: string;
  updatedBy?: ApiUser | string | null;
};

type ApiDeliveryRoute = ApiPickupRoute & {
  container?: ApiRef | null;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

const PICKUP_ROUTE_BAR_OR_SEARCH_FIELDS = [
  "name",
  "route.name",
  "driver.name",
  "appraiser.name",
  "date",
] as const;

const DELIVERY_ROUTE_BAR_OR_SEARCH_FIELDS = [
  ...PICKUP_ROUTE_BAR_OR_SEARCH_FIELDS,
  "container.name",
] as const;

function resolveRouteType(params: { routeType?: RouteType }): RouteType {
  if (params.routeType) return params.routeType;
  throw new Error("A route type is required to call the scheduled routes API.");
}

function scheduledRoutesEndpoint(routeType: RouteType): string {
  return routeType === "delivery"
    ? API_ENDPOINTS.DELIVERY_ROUTE_SCHEDULES
    : API_ENDPOINTS.PICKUP_ROUTE_SCHEDULES;
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

function normalizeEmployeeRef(raw?: ApiEmployeeRef | null): ActiveRoute["driver"] {
  if (!raw || typeof raw !== "object") return null;
  const id = Number(raw.id);
  const name = String(raw.name ?? "").trim();
  if (!Number.isInteger(id) || id <= 0 || !name) return null;
  return { id, name };
}

function normalizeContainerRef(raw?: ApiRef | null): ActiveRoute["container"] {
  if (!raw || typeof raw !== "object") return null;
  const id = Number(raw.id);
  const name = String(raw.name ?? "").trim();
  if (!Number.isInteger(id) || id <= 0) return null;
  return { id, name };
}

function normalizeRouteRef(raw?: ApiRef | null): ActiveRoute["route"] | null {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id ?? "").trim();
  const name = String(raw.name ?? "").trim();
  if (!id) return null;
  const routeId = String(raw.routeId ?? "").trim();
  return {
    id,
    name: name || routeId || id,
    ...(routeId ? { routeId } : {}),
  };
}

function normalizeAuditFields(item: ApiPickupRoute) {
  return {
    createdAt: String(item.createdAt ?? "").trim(),
    createdBy: readUserName(item.createdBy) || DEFAULT_CREATED_BY,
    updatedAt: String(item.updatedAt ?? "").trim(),
    updatedBy: readUserName(item.updatedBy) || "",
  };
}

export function normalizeApiPickupRoute(raw: unknown): ActiveRoute | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiPickupRoute;
  const id = String(item.id ?? "").trim();
  const route = normalizeRouteRef(item.route);
  if (!id || !route) return null;

  const dateRaw = String(item.date ?? "").trim();

  return {
    id,
    name: String(item.name ?? "").trim() || route.name || id,
    routeType: "pickup",
    container: null,
    date: dateRaw.includes("T") ? dateRaw.slice(0, 10) : dateRaw,
    route,
    driver: normalizeEmployeeRef(item.driver),
    appraiser: normalizeEmployeeRef(item.appraiser),
    ...normalizeAuditFields(item),
  };
}

export function normalizeApiDeliveryRoute(raw: unknown): ActiveRoute | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiDeliveryRoute;
  const id = String(item.id ?? "").trim();
  const route = normalizeRouteRef(item.route);
  const container = normalizeContainerRef(item.container);
  if (!id || !route || !container) return null;

  const dateRaw = String(item.date ?? "").trim();

  return {
    id,
    name: String(item.name ?? "").trim() || route.name || id,
    routeType: "delivery",
    container,
    date: dateRaw.includes("T") ? dateRaw.slice(0, 10) : dateRaw,
    route,
    driver: normalizeEmployeeRef(item.driver),
    appraiser: normalizeEmployeeRef(item.appraiser),
    ...normalizeAuditFields(item),
  };
}

function normalizeScheduledRoute(raw: unknown, routeType: RouteType): ActiveRoute | null {
  return routeType === "delivery"
    ? normalizeApiDeliveryRoute(raw)
    : normalizeApiPickupRoute(raw);
}

function unwrapRecord(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as PaginatedApiEnvelope<unknown>).data;
    if (Array.isArray(data)) return data[0];
    return data;
  }
  return payload;
}

function buildPickupRouteWritePayload(values: ActiveRouteFormValues): PickupRouteWritePayload {
  assertActiveRouteFormValues(values);
  if (values.routeType !== "pickup") {
    throw new Error("Pickup route payload requires routeType pickup.");
  }

  return {
    date: toRouteDateIso(values.date),
    route: { id: values.routeRecordId.trim() },
    driver: values.driver ? { id: values.driver.id, name: values.driver.name.trim() } : null,
    appraiser: values.appraiser
      ? { id: values.appraiser.id, name: values.appraiser.name.trim() }
      : null,
  };
}

function buildDeliveryRouteWritePayload(values: ActiveRouteFormValues): DeliveryRouteWritePayload {
  assertActiveRouteFormValues(values);
  if (values.routeType !== "delivery" || !values.container || values.container.id <= 0) {
    throw new Error("Delivery route payload requires a container.");
  }

  return {
    container: { id: values.container.id, name: values.container.name.trim() },
    date: toRouteDateIso(values.date),
    route: { id: values.routeRecordId.trim() },
    driver: values.driver ? { id: values.driver.id, name: values.driver.name.trim() } : null,
    appraiser: values.appraiser
      ? { id: values.appraiser.id, name: values.appraiser.name.trim() }
      : null,
  };
}

function buildScheduledRouteWritePayload(values: ActiveRouteFormValues) {
  return values.routeType === "delivery"
    ? buildDeliveryRouteWritePayload(values)
    : buildPickupRouteWritePayload(values);
}

function buildPickupRouteDaySearchBody(date: string) {
  const start = toRouteDateIso(date);
  const dateInput = date.trim().slice(0, 10);
  const next = new Date(`${dateInput}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = `${next.toISOString().slice(0, 10)}T00:00:00Z`;

  return buildStripeStyleSearchBody({
    sort: { field: "date", direction: "desc" },
    filterGroups: [
      {
        operator: "and",
        filters: [
          { field: "date", operator: "gte", value: start },
          { field: "date", operator: "lt", value: end },
        ],
      },
    ],
  });
}

function buildDeliveryRouteDaySearchBody(params: ActiveRouteLookupParams) {
  const start = toRouteDateIso(params.date);
  const dateInput = params.date.trim().slice(0, 10);
  const next = new Date(`${dateInput}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = `${next.toISOString().slice(0, 10)}T00:00:00Z`;

  const filters = [
    { field: "date", operator: "gte", value: start },
    { field: "date", operator: "lt", value: end },
  ];

  if (params.containerId) {
    filters.push({ field: "container.id", operator: "eq", value: String(params.containerId) });
  }

  return buildStripeStyleSearchBody({
    sort: { field: "date", direction: "desc" },
    filterGroups: [{ operator: "and", filters }],
  });
}

function matchesActiveRouteLookup(record: ActiveRoute, params: ActiveRouteLookupParams): boolean {
  const isoDate = params.date.trim().slice(0, 10);
  const sameDate = record.date === isoDate || record.date.startsWith(isoDate);
  if (!sameDate) return false;

  if (params.routeType === "delivery") {
    return (
      record.routeType === "delivery" &&
      Boolean(params.containerId) &&
      record.container?.id === params.containerId
    );
  }

  return record.routeType === "pickup";
}

function normalizePaginatedScheduledRoutes(
  payload: PaginatedApiEnvelope<unknown[]>,
  routeType: RouteType,
  context: { isFiltered?: boolean } = {},
): PaginatedResult<ActiveRoute> {
  const items = Array.isArray(payload.data)
    ? payload.data
        .map((row) => normalizeScheduledRoute(row, routeType))
        .filter((record): record is ActiveRoute => record != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: resolvePaginatedListTotal(payload, items.length, context),
  };
}

function buildScheduledRouteSearchBody(params: ActiveRouteListParams, routeType: RouteType) {
  const search = params.search;
  const sort = params.sort ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.sort;
  const barFields =
    routeType === "delivery"
      ? DELIVERY_ROUTE_BAR_OR_SEARCH_FIELDS
      : PICKUP_ROUTE_BAR_OR_SEARCH_FIELDS;

  if (!search?.value.trim()) {
    return buildStripeStyleSearchBody({ sort, filterGroups: [] });
  }

  if (search.field) {
    const explicitFilter = createTextSearchFilter(
      search.field,
      search.value,
      search.operator ?? "contains",
    );
    const searchGroups = explicitFilter ? [{ operator: "and" as const, filters: [explicitFilter] }] : [];
    return buildStripeStyleSearchBody({ sort, filterGroups: searchGroups });
  }

  const orGroup = createOrTextSearchFilterGroup(
    search.value,
    [...barFields],
    search.operator ?? "contains",
  );

  return buildStripeStyleSearchBody({
    sort,
    filterGroups: orGroup ? [orGroup] : [],
  });
}

export async function fetchActiveRoutes(
  params: ActiveRouteListParams = {},
): Promise<PaginatedResult<ActiveRoute>> {
  const routeType = resolveRouteType(params);

  if (ROUTES_USE_MOCK_DATA) {
    return activeRoutesMockApi.fetchActiveRoutes(params);
  }

  const page = params.page ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.limit;
  const endpoint = scheduledRoutesEndpoint(routeType);

  return fetchPaginatedResourceList({
    endpoint,
    page,
    limit,
    offset: params.offset,
    isFiltered: hasListTextSearch(params.search),
    buildGetQuery: () =>
      buildApiListQuery({
        page,
        limit,
        offset: params.offset,
        sort: params.sort ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.sort,
      }),
    buildSearchBody: () => buildScheduledRouteSearchBody(params, routeType),
    normalize: (payload, context) => normalizePaginatedScheduledRoutes(payload, routeType, context),
  });
}

async function searchActiveRouteByLookup(
  params: ActiveRouteLookupParams,
): Promise<ActiveRoute | null> {
  const isoDate = params.date.trim().slice(0, 10);
  if (!isoDate) return null;
  if (params.routeType === "delivery" && !params.containerId) return null;

  const endpoint = scheduledRoutesEndpoint(params.routeType);

  try {
    const listQuery = buildApiListQuery({
      page: 1,
      limit: 200,
      sort: { field: "date", direction: "desc" },
    });
    const listPayload = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
      `${endpoint}?${listQuery}`,
    );
    const listItems = Array.isArray(listPayload.data) ? listPayload.data : [];
    for (const row of listItems) {
      const record = normalizeScheduledRoute(row, params.routeType);
      if (record && matchesActiveRouteLookup(record, params)) {
        return record;
      }
    }
  } catch {
    // Fall through to POST /search.
  }

  const paginationQuery = buildApiSearchPaginationQuery({ page: 1, limit: 1, offset: 0 });
  const searchBody =
    params.routeType === "delivery"
      ? buildDeliveryRouteDaySearchBody(params)
      : buildPickupRouteDaySearchBody(isoDate);

  const payload = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
    `${endpoint}/search?${paginationQuery}`,
    searchBody,
  );

  const items = Array.isArray(payload.data) ? payload.data : [];
  const record = normalizeScheduledRoute(items[0], params.routeType);
  return record && matchesActiveRouteLookup(record, params) ? record : null;
}

export async function fetchActiveRoute(
  params: ActiveRouteLookupParams,
): Promise<ActiveRoute | null> {
  if (ROUTES_USE_MOCK_DATA) {
    return activeRoutesMockApi.fetchActiveRoute(params);
  }

  const date = params.date.trim().slice(0, 10);
  if (!date) return null;
  if (params.routeType === "delivery" && !params.containerId) return null;

  return searchActiveRouteByLookup({ ...params, date });
}

export async function fetchActiveRouteById(
  recordId: string,
  routeType: RouteType,
): Promise<ActiveRoute> {
  if (ROUTES_USE_MOCK_DATA) {
    return activeRoutesMockApi.fetchActiveRouteById(recordId);
  }

  const id = recordId.trim();
  if (!id) {
    throw new Error("A valid route id is required.");
  }

  const response = await apiClient.get<ApiPickupRoute | PaginatedApiEnvelope<ApiPickupRoute>>(
    `${scheduledRoutesEndpoint(routeType)}/${id}`,
  );

  const record = normalizeScheduledRoute(unwrapRecord(response), routeType);
  if (!record) {
    throw new Error("Route not found.");
  }

  return record;
}

function extractActiveRouteFromMutationResponse(
  data: unknown,
  routeType: RouteType,
): ActiveRoute | null {
  return normalizeScheduledRoute(unwrapRecord(data), routeType);
}

function buildLookupFromFormValues(values: ActiveRouteFormValues): ActiveRouteLookupParams {
  return {
    routeType: values.routeType,
    date: values.date.trim().slice(0, 10),
    ...(values.routeType === "delivery" && values.container
      ? { containerId: values.container.id }
      : {}),
  };
}

async function resolveSavedActiveRoute(
  recordId: string | null,
  values: ActiveRouteFormValues,
  response: ApiMutationEnvelope<unknown>,
): Promise<ActiveRoute> {
  const fromResponse = extractActiveRouteFromMutationResponse(
    response.data ?? response,
    values.routeType,
  );
  if (fromResponse) return fromResponse;

  if (recordId) {
    return fetchActiveRouteById(recordId, values.routeType);
  }

  const searched = await searchActiveRouteByLookup(buildLookupFromFormValues(values));
  if (searched) return searched;

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to save route.");
}

export async function createActiveRoute(values: ActiveRouteFormValues): Promise<ActiveRoute> {
  if (ROUTES_USE_MOCK_DATA) {
    return activeRoutesMockApi.createActiveRoute(values);
  }

  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    scheduledRoutesEndpoint(values.routeType),
    buildScheduledRouteWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create route.");
  return resolveSavedActiveRoute(null, values, response);
}

export async function updateActiveRoute(
  recordId: string,
  values: ActiveRouteFormValues,
): Promise<ActiveRoute> {
  if (ROUTES_USE_MOCK_DATA) {
    return activeRoutesMockApi.updateActiveRoute(recordId, values);
  }

  const id = recordId.trim();
  if (!id) {
    throw new Error("A valid route id is required to update.");
  }

  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${scheduledRoutesEndpoint(values.routeType)}/${id}`,
    buildScheduledRouteWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to update route.");
  return resolveSavedActiveRoute(id, values, response);
}

export async function upsertActiveRoute(
  values: ActiveRouteFormValues,
  existingId?: string | null,
): Promise<ActiveRoute> {
  if (ROUTES_USE_MOCK_DATA) {
    return activeRoutesMockApi.upsertActiveRoute(values, existingId);
  }

  const recordId = existingId?.trim();
  if (recordId) {
    return updateActiveRoute(recordId, values);
  }

  const existing = await searchActiveRouteByLookup(buildLookupFromFormValues(values));
  if (existing) {
    return updateActiveRoute(existing.id, values);
  }

  return createActiveRoute(values);
}

export async function deleteActiveRoute(recordId: string, routeType: RouteType): Promise<void> {
  if (ROUTES_USE_MOCK_DATA) {
    return activeRoutesMockApi.deleteActiveRoute(recordId);
  }

  const id = recordId.trim();
  if (!id) {
    throw new Error("A valid route id is required to delete.");
  }

  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${scheduledRoutesEndpoint(routeType)}/${id}`,
  );

  assertMutationSuccess(response, "Unable to delete route.");
}

export async function deleteActiveRoutes(
  recordIds: string[],
  routeType: RouteType,
): Promise<void> {
  if (ROUTES_USE_MOCK_DATA) {
    return activeRoutesMockApi.deleteActiveRoutes(recordIds);
  }

  await Promise.all(recordIds.map((id) => deleteActiveRoute(id, routeType)));
}
