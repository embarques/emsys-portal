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
import {
  assertActiveRouteFormValues,
  deriveRouteType,
  ACTIVE_ROUTE_BAR_OR_SEARCH_FIELDS,
  DEFAULT_ACTIVE_ROUTE_LIST_PARAMS,
  type ActiveRoute,
  type ActiveRouteFormValues,
  type ActiveRouteListParams,
  type ActiveRouteLookupParams,
} from "@/lib/active-routes/types";
import { ROUTES_USE_MOCK_DATA } from "@/lib/routes/data-source";
import * as activeRoutesMockApi from "@/lib/active-routes/api/active-routes-mock-api";
import { toRouteDateIso } from "@/lib/routes/types";

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

type ApiActiveRoute = {
  id?: string | number;
  name?: string;
  container?: ApiRef | null;
  date?: string;
  route?: ApiRef | null;
  driver?: ApiEmployeeRef | null;
  appraiser?: ApiEmployeeRef | null;
  createdAt?: string;
  createdBy?: ApiUser | string | null;
  updatedAt?: string;
  updatedBy?: ApiUser | string | null;
};

/** `name` is server-generated on create — do not send on POST. */
type ApiActiveRouteWritePayload = {
  container: { id: number; name: string } | null;
  date: string;
  route: { id: string };
  driver?: { id: number; name: string } | null;
  appraiser?: { id: number; name: string } | null;
  name?: string;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

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

export function normalizeApiActiveRoute(raw: unknown): ActiveRoute | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiActiveRoute;
  const id = String(item.id ?? "").trim();
  const route = normalizeRouteRef(item.route);
  if (!id || !route) return null;

  const container = normalizeContainerRef(item.container);
  const dateRaw = String(item.date ?? "").trim();

  return {
    id,
    name: String(item.name ?? "").trim() || route.name || id,
    routeType: deriveRouteType(container),
    container,
    date: dateRaw.includes("T") ? dateRaw.slice(0, 10) : dateRaw,
    route,
    driver: normalizeEmployeeRef(item.driver),
    appraiser: normalizeEmployeeRef(item.appraiser),
    createdAt: String(item.createdAt ?? "").trim(),
    createdBy: readUserName(item.createdBy) || DEFAULT_CREATED_BY,
    updatedAt: String(item.updatedAt ?? "").trim(),
    updatedBy: readUserName(item.updatedBy) || "",
  };
}

function unwrapRecord(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as PaginatedApiEnvelope<unknown>).data;
    if (Array.isArray(data)) return data[0];
    return data;
  }
  return payload;
}

function buildActiveRouteWritePayload(values: ActiveRouteFormValues): ApiActiveRouteWritePayload {
  assertActiveRouteFormValues(values);

  return {
    container:
      values.routeType === "delivery" && values.container && values.container.id > 0
        ? { id: values.container.id, name: values.container.name.trim() }
        : null,
    date: toRouteDateIso(values.date),
    route: {
      id: values.routeRecordId.trim(),
    },
    driver: values.driver ? { id: values.driver.id, name: values.driver.name.trim() } : null,
    appraiser: values.appraiser
      ? { id: values.appraiser.id, name: values.appraiser.name.trim() }
      : null,
  };
}

function buildActiveRouteDaySearchBody(params: ActiveRouteLookupParams) {
  const start = toRouteDateIso(params.date);
  const dateInput = params.date.trim().slice(0, 10);
  const next = new Date(`${dateInput}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = `${next.toISOString().slice(0, 10)}T00:00:00Z`;

  const filters = [
    { field: "date", operator: "gte", value: start },
    { field: "date", operator: "lt", value: end },
  ];

  if (params.routeType === "delivery" && params.containerId) {
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

function normalizePaginatedActiveRoutes(
  payload: PaginatedApiEnvelope<unknown[]>,
  context: { isFiltered?: boolean } = {},
): PaginatedResult<ActiveRoute> {
  const items = Array.isArray(payload.data)
    ? payload.data
        .map(normalizeApiActiveRoute)
        .filter((record): record is ActiveRoute => record != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: resolvePaginatedListTotal(payload, items.length, context),
  };
}

function buildActiveRouteSearchBody(params: ActiveRouteListParams) {
  const search = params.search;
  const sort = params.sort ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.sort;

  if (!search?.value.trim()) {
    return buildStripeStyleSearchBody({ sort, filterGroups: [] });
  }

  if (search.field) {
    const explicitFilter = createTextSearchFilter(
      search.field,
      search.value,
      search.operator ?? "contains",
    );
    return buildStripeStyleSearchBody({
      sort,
      filterGroups: explicitFilter ? [{ operator: "and", filters: [explicitFilter] }] : [],
    });
  }

  const orGroup = createOrTextSearchFilterGroup(
    search.value,
    [...ACTIVE_ROUTE_BAR_OR_SEARCH_FIELDS],
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
  if (ROUTES_USE_MOCK_DATA) {
    return activeRoutesMockApi.fetchActiveRoutes(params);
  }

  const page = params.page ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.limit;

  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.ACTIVE_ROUTES,
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
    buildSearchBody: () => buildActiveRouteSearchBody(params),
    normalize: normalizePaginatedActiveRoutes,
  });
}

async function searchActiveRouteByLookup(
  params: ActiveRouteLookupParams,
): Promise<ActiveRoute | null> {
  const isoDate = params.date.trim().slice(0, 10);
  if (!isoDate) return null;
  if (params.routeType === "delivery" && !params.containerId) return null;

  try {
    const listQuery = buildApiListQuery({
      page: 1,
      limit: 200,
      sort: { field: "date", direction: "desc" },
    });
    const listPayload = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
      `${API_ENDPOINTS.ACTIVE_ROUTES}?${listQuery}`,
    );
    const listItems = Array.isArray(listPayload.data) ? listPayload.data : [];
    for (const row of listItems) {
      const record = normalizeApiActiveRoute(row);
      if (record && matchesActiveRouteLookup(record, params)) {
        return record;
      }
    }
  } catch {
    // Fall through to POST /search.
  }

  const paginationQuery = buildApiSearchPaginationQuery({ page: 1, limit: 1, offset: 0 });
  const payload = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.ACTIVE_ROUTES}/search?${paginationQuery}`,
    buildActiveRouteDaySearchBody(params),
  );

  const items = Array.isArray(payload.data) ? payload.data : [];
  const record = normalizeApiActiveRoute(items[0]);
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

export async function fetchActiveRouteById(recordId: string): Promise<ActiveRoute> {
  if (ROUTES_USE_MOCK_DATA) {
    return activeRoutesMockApi.fetchActiveRouteById(recordId);
  }

  const id = recordId.trim();
  if (!id) {
    throw new Error("A valid active route id is required.");
  }

  const response = await apiClient.get<ApiActiveRoute | PaginatedApiEnvelope<ApiActiveRoute>>(
    `${API_ENDPOINTS.ACTIVE_ROUTES}/${id}`,
  );

  const record = normalizeApiActiveRoute(unwrapRecord(response));
  if (!record) {
    throw new Error("Active route not found.");
  }

  return record;
}

function extractActiveRouteFromMutationResponse(data: unknown): ActiveRoute | null {
  return normalizeApiActiveRoute(unwrapRecord(data));
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
  const fromResponse = extractActiveRouteFromMutationResponse(response.data ?? response);
  if (fromResponse) return fromResponse;

  if (recordId) {
    return fetchActiveRouteById(recordId);
  }

  const searched = await searchActiveRouteByLookup(buildLookupFromFormValues(values));
  if (searched) return searched;

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to save active route.");
}

export async function createActiveRoute(values: ActiveRouteFormValues): Promise<ActiveRoute> {
  if (ROUTES_USE_MOCK_DATA) {
    return activeRoutesMockApi.createActiveRoute(values);
  }

  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.ACTIVE_ROUTES,
    buildActiveRouteWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create active route.");
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
    throw new Error("A valid active route id is required to update.");
  }

  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.ACTIVE_ROUTES}/${id}`,
    buildActiveRouteWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to update active route.");
  return resolveSavedActiveRoute(id, values, response);
}

/** Create or update the active route for a route type + calendar day. */
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

export async function deleteActiveRoute(recordId: string): Promise<void> {
  if (ROUTES_USE_MOCK_DATA) {
    return activeRoutesMockApi.deleteActiveRoute(recordId);
  }

  const id = recordId.trim();
  if (!id) {
    throw new Error("A valid active route id is required to delete.");
  }

  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.ACTIVE_ROUTES}/${id}`,
  );

  assertMutationSuccess(response, "Unable to delete active route.");
}

export async function deleteActiveRoutes(recordIds: string[]): Promise<void> {
  if (ROUTES_USE_MOCK_DATA) {
    return activeRoutesMockApi.deleteActiveRoutes(recordIds);
  }

  await Promise.all(recordIds.map((id) => deleteActiveRoute(id)));
}
