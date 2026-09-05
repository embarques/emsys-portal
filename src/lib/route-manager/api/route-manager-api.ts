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
import { buildApiBranchDto, type ApiBranchDtoPayload } from "@/lib/api/payloads";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { resolvePaginatedListTotal } from "@/lib/api/types";
import {
  DEFAULT_ROUTE_LIST_PARAMS,
  ROUTE_BAR_OR_SEARCH_FIELDS,
  toRouteDateIso,
  type Route,
  type RouteBranchRef,
  type RouteCrewRole,
  type RouteFormValues,
  type RouteListParams,
} from "@/lib/route-manager/types";
import { isRouteListFiltered } from "@/lib/route-manager/branch-filter";

type ApiUser = {
  id?: number;
  name?: string;
  userName?: string;
  fullName?: string;
};

type ApiRef = {
  id?: string | number;
  name?: string;
  branch?: string;
};

type ApiEmployeeRef = {
  id?: string | number;
  name?: string;
  role?: string;
};

type ApiEmployeeGroupRef = ApiRef & {
  employeeGroupId?: string;
  branch?: string;
  employees?: ApiEmployeeRef[];
};

type ApiBranchRef = {
  id?: number;
  code?: string;
  name?: string;
};

type ApiRoute = {
  id?: string | number;
  routeId?: string;
  routeAssignmentId?: string;
  name?: string;
  date?: string;
  tripNumber?: number;
  branch?: ApiBranchRef | null;
  vehicle?: ApiRef | null;
  employees?: ApiEmployeeRef[];
  employeeGroup?: ApiEmployeeGroupRef | null;
  active?: boolean;
  createdAt?: string;
  createdBy?: ApiUser | string | null;
  updatedAt?: string;
  updatedBy?: ApiUser | string | null;
};

/** POST/PUT /routes — `name` and `routeId` are server-generated on create. */
type ApiRouteWritePayload = {
  routeId?: string;
  name?: string;
  branch?: ApiBranchDtoPayload;
  employees: { id: number; name: string }[];
  active: boolean;
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
  const branch = String(ref.branch ?? "").trim();
  return {
    id: String(ref.id ?? "").trim(),
    name: String(ref.name ?? "").trim(),
    ...(branch ? { branch } : {}),
  };
}

function normalizeCrewRole(raw: unknown): RouteCrewRole {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "driver" || value === "appraiser" || value === "helper") return value;
  return "helper";
}

function normalizeBranchRef(raw?: ApiBranchRef | null): RouteBranchRef | null {
  if (!raw || typeof raw !== "object") return null;
  const id = Number(raw.id);
  const code = String(raw.code ?? "").trim();
  const name = String(raw.name ?? "").trim();
  if (!code && !(Number.isInteger(id) && id > 0)) return null;
  return {
    id: Number.isInteger(id) && id > 0 ? id : 0,
    code,
    ...(name ? { name } : {}),
  };
}

function normalizeEmployeeRef(raw: unknown): Route["employees"][number] | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as ApiEmployeeRef;
  const id = Number(entry.id);
  const name = String(entry.name ?? "").trim();
  if (!Number.isInteger(id) || id <= 0 || !name) return null;
  const role = String(entry.role ?? "").trim();
  return role ? { id, name, role: normalizeCrewRole(role) } : { id, name };
}

function normalizeRouteEmployees(item: ApiRoute): Route["employees"] {
  if (Array.isArray(item.employees)) {
    return item.employees
      .map(normalizeEmployeeRef)
      .filter((employee): employee is Route["employees"][number] => employee != null);
  }

  const nested = item.employeeGroup?.employees;
  if (Array.isArray(nested)) {
    return nested
      .map(normalizeEmployeeRef)
      .filter((employee): employee is Route["employees"][number] => employee != null);
  }

  return [];
}

export function normalizeApiRoute(raw: unknown): Route | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiRoute;
  const id = String(item.id ?? "").trim();
  if (!id) return null;

  const vehicle = normalizeVehicleRef(item.vehicle);
  const branch =
    normalizeBranchRef(item.branch) ??
    (vehicle.branch ? { id: 0, code: vehicle.branch } : null);

  return {
    id,
    routeId: String(item.routeId ?? item.routeAssignmentId ?? "").trim(),
    name: String(item.name ?? "").trim(),
    date: String(item.date ?? "").trim(),
    tripNumber: Number(item.tripNumber ?? 0),
    branch,
    vehicle,
    employees: normalizeRouteEmployees(item),
    active: item.active !== false,
    createdAt: String(item.createdAt ?? "").trim(),
    createdBy: readUserName(item.createdBy) || DEFAULT_CREATED_BY,
    updatedAt: String(item.updatedAt ?? "").trim(),
    updatedBy: readUserName(item.updatedBy) || "",
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
  const branchCode = params.branchCode?.trim();
  const filterGroups: ApiSearchFilterGroup[] = [];

  if (branchCode) {
    filterGroups.push({
      operator: "and",
      filters: [{ field: "branch.code", operator: "eq", value: branchCode }],
    });
  }

  if (!search?.value.trim()) {
    return buildStripeStyleSearchBody({ sort, filterGroups });
  }

  if (search.field) {
    const explicitFilter = createTextSearchFilter(
      search.field,
      search.value,
      search.operator ?? "contains",
    );
    if (explicitFilter) {
      filterGroups.push({ operator: "and", filters: [explicitFilter] });
    }
    return buildStripeStyleSearchBody({ sort, filterGroups });
  }

  const orGroup = createOrTextSearchFilterGroup(
    search.value,
    [...ROUTE_BAR_OR_SEARCH_FIELDS],
    search.operator ?? "contains",
  );

  if (orGroup) {
    filterGroups.push(orGroup);
  }

  return buildStripeStyleSearchBody({
    sort,
    filterGroups,
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
    isFiltered: isRouteListFiltered(params),
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
  mode: "create" | "update",
): ApiRouteWritePayload {
  if (values.employees.length === 0) {
    throw new Error("Select at least one employee.");
  }

  const branchCode = values.branch?.code.trim() ?? "";
  const branchName = values.branch?.name?.trim() ?? "";
  if (!values.branch || !(values.branch.id > 0)) {
    throw new Error("Branch is required.");
  }
  if (!branchName) {
    throw new Error("Branch name is required.");
  }

  const payload: ApiRouteWritePayload = {
    branch: buildApiBranchDto({
      id: values.branch.id,
      code: branchCode,
      name: branchName,
    }),
    employees: values.employees.map((employee) => ({
      id: employee.id,
      name: employee.name.trim(),
    })),
    active: values.active,
  };

  if (mode === "update") {
    if (values.name.trim()) {
      payload.name = values.name.trim();
    }
  }

  return payload;
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
      search: { field: "routeId", operator: "eq", value: routeId },
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
    buildRouteWritePayload(values, "create"),
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
    buildRouteWritePayload(values, "update"),
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
