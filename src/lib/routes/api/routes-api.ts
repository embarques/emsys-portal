import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
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
  DEFAULT_ROUTE_LIST_PARAMS,
  ROUTE_BAR_OR_SEARCH_FIELDS,
  toRouteDateIso,
  type Route,
  type RouteFormValues,
  type RouteListParams,
} from "@/lib/routes/types";

type ApiUser = {
  id?: number;
  name?: string;
  userName?: string;
  fullName?: string;
};

type ApiRef = {
  id?: string | number;
  name?: string;
};

type ApiEmployeeGroupRef = ApiRef & {
  employeeGroupId?: string;
  branch?: string;
  employees?: unknown[];
};

type ApiRoute = {
  id?: string | number;
  routeAssignmentId?: string;
  name?: string;
  date?: string;
  vehicle?: ApiRef | null;
  employeeGroup?: ApiEmployeeGroupRef | null;
  createdAt?: string;
  createdBy?: ApiUser | string | null;
  updatedAt?: string;
  updatedBy?: ApiUser | string | null;
};

/** POST/PUT /routes — see API_PAYLOADS.md */
type ApiRouteWritePayload = {
  routeAssignmentId: string;
  name: string;
  date: string;
  vehicle?: { id: string; name: string };
  employeeGroup: { id: string; name: string };
  id?: string;
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

function normalizeVehicleRef(raw?: ApiRef | null): Route["vehicle"] {
  const ref = raw ?? {};
  return {
    id: String(ref.id ?? "").trim(),
    name: String(ref.name ?? "").trim(),
  };
}

function normalizeEmployeeGroupRef(raw?: ApiEmployeeGroupRef | null): Route["employeeGroup"] {
  const ref = raw ?? {};
  const id = String(ref.id ?? ref.employeeGroupId ?? "").trim();
  const name = String(ref.name ?? "").trim() || String(ref.employeeGroupId ?? "").trim();
  const branch = String(ref.branch ?? "").trim();
  return { id, name, ...(branch ? { branch } : {}) };
}

export function normalizeApiRoute(raw: unknown): Route | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiRoute;
  const id = String(item.id ?? "").trim();
  if (!id) return null;

  return {
    id,
    routeId: String(item.routeAssignmentId ?? "").trim(),
    name: String(item.name ?? "").trim(),
    date: String(item.date ?? "").trim(),
    vehicle: normalizeVehicleRef(item.vehicle),
    employeeGroup: normalizeEmployeeGroupRef(item.employeeGroup),
    createdAt: String(item.createdAt ?? "").trim(),
    createdBy: readUserName(item.createdBy) || DEFAULT_CREATED_BY,
    updatedAt: String(item.updatedAt ?? "").trim(),
  };
}

function normalizePaginatedRoutes(
  payload: PaginatedApiEnvelope<unknown[]>,
  context: { isFiltered?: boolean } = {},
): PaginatedResult<Route> {
  const items = Array.isArray(payload.data)
    ? payload.data
        .map(normalizeApiRoute)
        .filter((assignment): assignment is Route => assignment != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: resolvePaginatedListTotal(payload, items.length, context),
  };
}

function buildRouteSearchBody(params: RouteListParams) {
  const search = params.search;
  const sort = params.sort ?? DEFAULT_ROUTE_LIST_PARAMS.sort;

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
    [...ROUTE_BAR_OR_SEARCH_FIELDS],
    search.operator ?? "contains",
  );

  return buildStripeStyleSearchBody({
    sort,
    filterGroups: orGroup ? [orGroup] : [],
  });
}

export async function fetchRoutes(
  params: RouteListParams = {},
): Promise<PaginatedResult<Route>> {
  const page = params.page ?? DEFAULT_ROUTE_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_ROUTE_LIST_PARAMS.limit;

  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.ROUTES,
    page,
    limit,
    offset: params.offset,
    isFiltered: hasListTextSearch(params.search),
    buildGetQuery: () =>
      buildApiListQuery({
        page,
        limit,
        offset: params.offset,
        sort: params.sort ?? DEFAULT_ROUTE_LIST_PARAMS.sort,
      }),
    buildSearchBody: () => buildRouteSearchBody(params),
    normalize: normalizePaginatedRoutes,
  });
}

/**
 * Fetch every route dated on `dateInput` (YYYY-MM-DD) using an inclusive-start,
 * exclusive-end date range. Used for day-scoped KPIs so the stat cards reflect
 * only the selected day's routes rather than the full history.
 */
export async function fetchRoutesByDate(
  dateInput: string,
): Promise<PaginatedResult<Route>> {
  const start = toRouteDateIso(dateInput);
  const next = new Date(`${dateInput}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = `${next.toISOString().slice(0, 10)}T00:00:00Z`;

  const body = buildStripeStyleSearchBody({
    sort: DEFAULT_ROUTE_LIST_PARAMS.sort,
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

  const paginationQuery = buildApiSearchPaginationQuery({ page: 1, limit: 200 });
  const response = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.ROUTES}/search?${paginationQuery}`,
    body,
  );

  return normalizePaginatedRoutes(response, { isFiltered: true });
}

export async function fetchRouteById(routeId: string): Promise<Route> {
  const id = routeId.trim();
  if (!id) {
    throw new Error("A valid route id is required.");
  }

  const response = await apiClient.get<ApiRoute | PaginatedApiEnvelope<ApiRoute>>(
    `${API_ENDPOINTS.ROUTES}/${id}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiRoute>).data
      : response;

  const assignment = normalizeApiRoute(raw);
  if (!assignment) {
    throw new Error("Route not found.");
  }

  return assignment;
}

function buildRouteWritePayload(
  values: RouteFormValues,
  options: { recordId?: string } = {},
): ApiRouteWritePayload {
  const employeeGroupId = values.employeeGroup.id.trim();
  if (!employeeGroupId) {
    throw new Error("An employee group is required.");
  }

  const payload: ApiRouteWritePayload = {
    routeAssignmentId: values.routeId.trim(),
    name: values.name.trim(),
    date: toRouteDateIso(values.date),
    employeeGroup: {
      id: employeeGroupId,
      name: values.employeeGroup.name.trim(),
    },
  };

  const vehicleId = values.vehicle.id.trim();
  if (vehicleId) {
    payload.vehicle = {
      id: vehicleId,
      name: values.vehicle.name.trim(),
    };
  }

  if (options.recordId) {
    payload.id = options.recordId;
  }

  return payload;
}

function assertMutationSuccess(response: ApiMutationEnvelope<unknown>, fallbackMessage: string) {
  if (response.success === false) {
    throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
  }
}

function extractRouteFromMutationResponse(data: unknown): Route | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeApiRoute(data);
  }
  return null;
}

function extractCreatedRouteId(response: ApiMutationEnvelope<unknown>): string | null {
  const data = response.data;

  if (typeof data === "string") {
    const id = data.trim();
    return id || null;
  }

  const assignment = extractRouteFromMutationResponse(data);
  return assignment?.id ?? null;
}

async function resolveCreatedRoute(
  values: RouteFormValues,
  response: ApiMutationEnvelope<unknown>,
): Promise<Route> {
  const createdId = extractCreatedRouteId(response);
  if (createdId) {
    return fetchRouteById(createdId);
  }

  const assignment = extractRouteFromMutationResponse(response.data);
  if (assignment) {
    return assignment;
  }

  const routeId = values.routeId.trim();
  if (routeId) {
    const matches = await fetchRoutes({
      page: 1,
      limit: 1,
      search: { field: "routeAssignmentId", operator: "eq", value: routeId },
    });

    const matched = matches.items[0];
    if (matched) {
      return matched;
    }
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to create route.");
}

export async function createRoute(
  values: RouteFormValues,
): Promise<Route> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.ROUTES,
    buildRouteWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create route.");

  return resolveCreatedRoute(values, response);
}

export async function updateRoute(
  recordId: string,
  values: RouteFormValues,
): Promise<Route> {
  const id = recordId.trim();
  if (!id) {
    throw new Error("A valid route id is required to update.");
  }

  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.ROUTES}/${id}`,
    buildRouteWritePayload(values, { recordId: id }),
  );

  assertMutationSuccess(response, "Unable to update route.");

  return extractRouteFromMutationResponse(response.data) ?? fetchRouteById(id);
}

export async function deleteRoute(recordId: string): Promise<void> {
  const id = recordId.trim();
  if (!id) {
    throw new Error("A valid route id is required to delete.");
  }

  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.ROUTES}/${id}`,
  );

  assertMutationSuccess(response, "Unable to delete route.");
}

export async function deleteRoutes(recordIds: string[]): Promise<void> {
  await Promise.all(recordIds.map((id) => deleteRoute(id)));
}

/**
 * Assign pickups (orders) to a route via PUT /pickups/route/{routeId} with
 * `{ pickupIds }`. Each pickup then stores a `{ id, name }` route reference,
 * which the orders table can filter on via `route.id` / `route.name`.
 */
export async function assignPickupsToRoute(
  routeId: string,
  pickupIds: number[],
): Promise<void> {
  const id = routeId.trim();
  if (!id) {
    throw new Error("A valid route is required.");
  }

  if (pickupIds.length === 0) {
    throw new Error("Select at least one pickup to assign.");
  }

  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.PICKUP_ROUTES}/${id}`,
    { pickupIds },
  );

  assertMutationSuccess(response, "Unable to assign route.");
}
