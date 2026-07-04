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
  type ApiSearchFilterGroup,
} from "@/lib/api/search-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { resolvePaginatedListTotal } from "@/lib/api/types";
import type { VehicleRouteWritePayload } from "@/lib/pickup-delivery-routes/api-schemas";
import {
  assertActiveRouteFormValues,
  DEFAULT_ACTIVE_ROUTE_LIST_PARAMS,
  deriveRouteType,
  type ActiveRoute,
  type ActiveRouteFormValues,
  type ActiveRouteListParams,
  type ActiveRouteLookupParams,
  type RouteType,
} from "@/lib/pickup-delivery-routes/types";
import { ROUTES_USE_MOCK_DATA } from "@/lib/route-manager/data-source";
import * as activeRoutesMockApi from "@/lib/pickup-delivery-routes/api/pickup-delivery-routes-mock-api";
import {
  DEFAULT_ROUTE_CREW_ROLE,
  resolveCrewRole,
  toRouteDateIso,
  type RouteCrewRole,
} from "@/lib/route-manager/types";

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

type ApiContainerRef = {
  id?: string | number;
  name?: string;
  number?: string;
};

type ApiBranchRef = {
  id?: string | number;
  code?: string;
};

type ApiEmployeeRef = {
  id?: string | number;
  name?: string;
  role?: string;
};

type ApiVehicleRoute = {
  id?: string | number;
  name?: string;
  routeType?: string;
  active?: boolean;
  date?: string;
  dayOfWeek?: string | string[] | null;
  branch?: ApiBranchRef | null;
  container?: ApiContainerRef | null;
  route?: ApiRef | null;
  employees?: ApiEmployeeRef[] | null;
  createdAt?: string;
  createdBy?: ApiUser | string | null;
  updatedAt?: string;
  updatedBy?: ApiUser | string | null;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

const VEHICLE_ROUTE_BAR_OR_SEARCH_FIELDS = [
  "name",
  "route.name",
  "employees.name",
  "container.name",
  "date",
] as const;

function readUserName(user: unknown): string {
  if (!user) return "";
  if (typeof user === "string") return user.trim();
  if (typeof user === "object") {
    const entry = user as ApiUser;
    return String(entry.fullName ?? entry.userName ?? entry.name ?? "").trim();
  }
  return "";
}

function normalizeCrewRole(raw: unknown): RouteCrewRole {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "driver" || value === "appraiser" || value === "helper") return value;
  return DEFAULT_ROUTE_CREW_ROLE;
}

function normalizeDaysOfWeek(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : raw != null && raw !== "" ? [raw] : [];
  return list
    .map((entry) => String(entry ?? "").trim().toLowerCase())
    .filter(Boolean);
}

function normalizeEmployees(raw?: ApiEmployeeRef[] | null): ActiveRoute["employees"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      const id = Number(entry?.id);
      const name = String(entry?.name ?? "").trim();
      if (!Number.isInteger(id) || id <= 0 || !name) return null;
      return { id, name, role: normalizeCrewRole(entry?.role) };
    })
    .filter((employee): employee is NonNullable<typeof employee> => employee != null);
}

function normalizeContainerRef(raw?: ApiContainerRef | null): ActiveRoute["container"] {
  if (!raw || typeof raw !== "object") return null;
  const id = Number(raw.id);
  const name = String(raw.name ?? raw.number ?? "").trim();
  if (!Number.isInteger(id) || id <= 0) return null;
  return { id, name };
}

function normalizeBranchRef(raw?: ApiBranchRef | null): ActiveRoute["branch"] {
  if (!raw || typeof raw !== "object") return null;
  const id = Number(raw.id);
  const code = String(raw.code ?? "").trim();
  if (!Number.isInteger(id) || id <= 0) return null;
  return { id, code };
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

function normalizeAuditFields(item: ApiVehicleRoute) {
  return {
    createdAt: String(item.createdAt ?? "").trim(),
    createdBy: readUserName(item.createdBy) || DEFAULT_CREATED_BY,
    updatedAt: String(item.updatedAt ?? "").trim(),
    updatedBy: readUserName(item.updatedBy) || "",
  };
}

export function normalizeApiVehicleRoute(raw: unknown): ActiveRoute | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiVehicleRoute;
  const id = String(item.id ?? "").trim();
  const route = normalizeRouteRef(item.route);
  if (!id || !route) return null;

  const container = normalizeContainerRef(item.container);
  const rawType = String(item.routeType ?? "").trim().toLowerCase();
  const routeType: RouteType =
    rawType === "pickup" || rawType === "delivery" ? rawType : deriveRouteType(container);

  const dateRaw = String(item.date ?? "").trim();

  return {
    id,
    name: String(item.name ?? "").trim() || route.name || id,
    routeType,
    container,
    date: dateRaw.includes("T") ? dateRaw.slice(0, 10) : dateRaw,
    dayOfWeek: normalizeDaysOfWeek(item.dayOfWeek),
    branch: normalizeBranchRef(item.branch),
    active: item.active !== false,
    route,
    employees: normalizeEmployees(item.employees),
    ...normalizeAuditFields(item),
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

function buildEmployeeWriteRefs(values: ActiveRouteFormValues) {
  return values.employees.map((employee) => ({
    id: employee.id,
    name: employee.name.trim(),
    role: resolveCrewRole(employee.role),
  }));
}

function buildVehicleRouteWritePayload(values: ActiveRouteFormValues): VehicleRouteWritePayload {
  assertActiveRouteFormValues(values);

  const payload: VehicleRouteWritePayload = {
    routeType: values.routeType,
    active: values.active,
    branch: { id: values.branch.id, code: values.branch.code.trim() },
    route: {
      id: values.routeRecordId.trim(),
      name: values.routeAssignmentName.trim() || values.routeRecordId.trim(),
    },
    employees: buildEmployeeWriteRefs(values),
  };

  if (values.scheduleType === "dayOfWeek") {
    payload.dayOfWeek = values.dayOfWeek.map((day) => day.trim().toLowerCase()).filter(Boolean);
  } else {
    payload.date = toRouteDateIso(values.date);
  }

  // Pickup name is optional (server-generated when empty); delivery name is
  // always server-generated, so only forward a name for pickups.
  if (values.routeType === "pickup" && values.name.trim()) {
    payload.name = values.name.trim();
  }

  if (values.routeType === "delivery" && values.container && values.container.id > 0) {
    payload.container = {
      id: values.container.id,
      number: values.container.name.trim(),
    };
  }

  return payload;
}

function routeTypeFilterGroup(routeType: RouteType): ApiSearchFilterGroup {
  return {
    operator: "and",
    filters: [{ field: "routeType", operator: "eq", value: routeType }],
  };
}

function normalizePaginatedVehicleRoutes(
  payload: PaginatedApiEnvelope<unknown[]>,
  context: { isFiltered?: boolean } = {},
): PaginatedResult<ActiveRoute> {
  const items = Array.isArray(payload.data)
    ? payload.data
        .map((row) => normalizeApiVehicleRoute(row))
        .filter((record): record is ActiveRoute => record != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: resolvePaginatedListTotal(payload, items.length, context),
  };
}

function buildVehicleRouteSearchBody(params: ActiveRouteListParams, routeType: RouteType) {
  const search = params.search;
  const sort = params.sort ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.sort;
  const filterGroups: ApiSearchFilterGroup[] = [routeTypeFilterGroup(routeType)];

  if (search?.value.trim()) {
    if (search.field) {
      const explicitFilter = createTextSearchFilter(
        search.field,
        search.value,
        search.operator ?? "contains",
      );
      if (explicitFilter) {
        filterGroups.push({ operator: "and", filters: [explicitFilter] });
      }
    } else {
      const orGroup = createOrTextSearchFilterGroup(
        search.value,
        [...VEHICLE_ROUTE_BAR_OR_SEARCH_FIELDS],
        search.operator ?? "contains",
      );
      if (orGroup) filterGroups.push(orGroup);
    }
  }

  return buildStripeStyleSearchBody({ sort, filterGroups });
}

export async function fetchActiveRoutes(
  params: ActiveRouteListParams = {},
): Promise<PaginatedResult<ActiveRoute>> {
  const routeType = params.routeType ?? "pickup";

  if (ROUTES_USE_MOCK_DATA) {
    return activeRoutesMockApi.fetchActiveRoutes(params);
  }

  const page = params.page ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.limit;

  // routeType is always filtered on the shared endpoint, so use POST /search.
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.VEHICLE_ROUTES,
    page,
    limit,
    offset: params.offset,
    isFiltered: true,
    buildGetQuery: () =>
      buildApiListQuery({
        page,
        limit,
        offset: params.offset,
        sort: params.sort ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.sort,
      }),
    buildSearchBody: () => buildVehicleRouteSearchBody(params, routeType),
    normalize: normalizePaginatedVehicleRoutes,
  });
}

function buildDayRangeFilters(date: string) {
  const start = toRouteDateIso(date);
  const dateInput = date.trim().slice(0, 10);
  const next = new Date(`${dateInput}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = `${next.toISOString().slice(0, 10)}T00:00:00Z`;
  return [
    { field: "date", operator: "gte", value: start },
    { field: "date", operator: "lt", value: end },
  ];
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

async function searchActiveRouteByLookup(
  params: ActiveRouteLookupParams,
): Promise<ActiveRoute | null> {
  const isoDate = params.date.trim().slice(0, 10);
  if (!isoDate) return null;
  if (params.routeType === "delivery" && !params.containerId) return null;

  const filters = [
    ...buildDayRangeFilters(isoDate),
    { field: "routeType", operator: "eq", value: params.routeType },
  ];
  if (params.routeType === "delivery" && params.containerId) {
    filters.push({ field: "container.id", operator: "eq", value: String(params.containerId) });
  }

  const searchBody = buildStripeStyleSearchBody({
    sort: { field: "date", direction: "desc" },
    filterGroups: [{ operator: "and", filters }],
  });

  const paginationQuery = buildApiSearchPaginationQuery({ page: 1, limit: 5, offset: 0 });
  const payload = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.VEHICLE_ROUTES}/search?${paginationQuery}`,
    searchBody,
  );

  const items = Array.isArray(payload.data) ? payload.data : [];
  for (const row of items) {
    const record = normalizeApiVehicleRoute(row);
    if (record && matchesActiveRouteLookup(record, params)) {
      return record;
    }
  }
  return null;
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

  void routeType;
  const response = await apiClient.get<ApiVehicleRoute | PaginatedApiEnvelope<ApiVehicleRoute>>(
    `${API_ENDPOINTS.VEHICLE_ROUTES}/${id}`,
  );

  const record = normalizeApiVehicleRoute(unwrapRecord(response));
  if (!record) {
    throw new Error("Route not found.");
  }

  return record;
}

function extractActiveRouteFromMutationResponse(data: unknown): ActiveRoute | null {
  return normalizeApiVehicleRoute(unwrapRecord(data));
}

async function resolveSavedActiveRoute(
  recordId: string | null,
  values: ActiveRouteFormValues,
  response: ApiMutationEnvelope<unknown>,
): Promise<ActiveRoute> {
  const fromResponse = extractActiveRouteFromMutationResponse(response.data ?? response);
  if (fromResponse) return fromResponse;

  if (recordId) {
    return fetchActiveRouteById(recordId, values.routeType);
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to save route.");
}

export async function createActiveRoute(values: ActiveRouteFormValues): Promise<ActiveRoute> {
  if (ROUTES_USE_MOCK_DATA) {
    return activeRoutesMockApi.createActiveRoute(values);
  }

  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.VEHICLE_ROUTES,
    buildVehicleRouteWritePayload(values),
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
    `${API_ENDPOINTS.VEHICLE_ROUTES}/${id}`,
    buildVehicleRouteWritePayload(values),
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

  void routeType;
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.VEHICLE_ROUTES}/${id}`,
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
