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
  DEFAULT_ROUTE_ASSIGNMENT_LIST_PARAMS,
  ROUTE_ASSIGNMENT_BAR_OR_SEARCH_FIELDS,
  toRouteAssignmentDateIso,
  type RouteAssignment,
  type RouteAssignmentFormValues,
  type RouteAssignmentListParams,
} from "@/lib/route-assignments/types";

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

type ApiRouteAssignment = {
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
type ApiRouteAssignmentWritePayload = {
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

function normalizeVehicleRef(raw?: ApiRef | null): RouteAssignment["vehicle"] {
  const ref = raw ?? {};
  return {
    id: String(ref.id ?? "").trim(),
    name: String(ref.name ?? "").trim(),
  };
}

function normalizeEmployeeGroupRef(raw?: ApiEmployeeGroupRef | null): RouteAssignment["employeeGroup"] {
  const ref = raw ?? {};
  const id = String(ref.id ?? "").trim();
  const name = String(ref.name ?? "").trim() || String(ref.employeeGroupId ?? "").trim();
  return { id, name };
}

export function normalizeApiRouteAssignment(raw: unknown): RouteAssignment | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiRouteAssignment;
  const id = String(item.id ?? "").trim();
  if (!id) return null;

  return {
    id,
    routeAssignmentId: String(item.routeAssignmentId ?? "").trim(),
    name: String(item.name ?? "").trim(),
    date: String(item.date ?? "").trim(),
    vehicle: normalizeVehicleRef(item.vehicle),
    employeeGroup: normalizeEmployeeGroupRef(item.employeeGroup),
    createdAt: String(item.createdAt ?? "").trim(),
    createdBy: readUserName(item.createdBy) || DEFAULT_CREATED_BY,
    updatedAt: String(item.updatedAt ?? "").trim(),
  };
}

function normalizePaginatedRouteAssignments(
  payload: PaginatedApiEnvelope<unknown[]>,
  context: { isFiltered?: boolean } = {},
): PaginatedResult<RouteAssignment> {
  const items = Array.isArray(payload.data)
    ? payload.data
        .map(normalizeApiRouteAssignment)
        .filter((assignment): assignment is RouteAssignment => assignment != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: resolvePaginatedListTotal(payload, items.length, context),
  };
}

function buildRouteAssignmentSearchBody(params: RouteAssignmentListParams) {
  const search = params.search;
  const sort = params.sort ?? DEFAULT_ROUTE_ASSIGNMENT_LIST_PARAMS.sort;

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
    [...ROUTE_ASSIGNMENT_BAR_OR_SEARCH_FIELDS],
    search.operator ?? "contains",
  );

  return buildStripeStyleSearchBody({
    sort,
    filterGroups: orGroup ? [orGroup] : [],
  });
}

export async function fetchRouteAssignments(
  params: RouteAssignmentListParams = {},
): Promise<PaginatedResult<RouteAssignment>> {
  const page = params.page ?? DEFAULT_ROUTE_ASSIGNMENT_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_ROUTE_ASSIGNMENT_LIST_PARAMS.limit;

  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.ROUTE_ASSIGNMENTS,
    page,
    limit,
    offset: params.offset,
    isFiltered: hasListTextSearch(params.search),
    buildGetQuery: () =>
      buildApiListQuery({
        page,
        limit,
        offset: params.offset,
        sort: params.sort ?? DEFAULT_ROUTE_ASSIGNMENT_LIST_PARAMS.sort,
      }),
    buildSearchBody: () => buildRouteAssignmentSearchBody(params),
    normalize: normalizePaginatedRouteAssignments,
  });
}

/**
 * Fetch every route dated on `dateInput` (YYYY-MM-DD) using an inclusive-start,
 * exclusive-end date range. Used for day-scoped KPIs so the stat cards reflect
 * only the selected day's routes rather than the full history.
 */
export async function fetchRouteAssignmentsByDate(
  dateInput: string,
): Promise<PaginatedResult<RouteAssignment>> {
  const start = toRouteAssignmentDateIso(dateInput);
  const next = new Date(`${dateInput}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = `${next.toISOString().slice(0, 10)}T00:00:00Z`;

  const body = buildStripeStyleSearchBody({
    sort: DEFAULT_ROUTE_ASSIGNMENT_LIST_PARAMS.sort,
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
    `${API_ENDPOINTS.ROUTE_ASSIGNMENTS}/search?${paginationQuery}`,
    body,
  );

  return normalizePaginatedRouteAssignments(response, { isFiltered: true });
}

export async function fetchRouteAssignmentById(routeAssignmentId: string): Promise<RouteAssignment> {
  const id = routeAssignmentId.trim();
  if (!id) {
    throw new Error("A valid route assignment id is required.");
  }

  const response = await apiClient.get<ApiRouteAssignment | PaginatedApiEnvelope<ApiRouteAssignment>>(
    `${API_ENDPOINTS.ROUTE_ASSIGNMENTS}/${id}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiRouteAssignment>).data
      : response;

  const assignment = normalizeApiRouteAssignment(raw);
  if (!assignment) {
    throw new Error("Route assignment not found.");
  }

  return assignment;
}

function buildRouteAssignmentWritePayload(
  values: RouteAssignmentFormValues,
  options: { recordId?: string } = {},
): ApiRouteAssignmentWritePayload {
  const employeeGroupId = values.employeeGroup.id.trim();
  if (!employeeGroupId) {
    throw new Error("An employee group is required.");
  }

  const payload: ApiRouteAssignmentWritePayload = {
    routeAssignmentId: values.routeAssignmentId.trim(),
    name: values.name.trim(),
    date: toRouteAssignmentDateIso(values.date),
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

function extractRouteAssignmentFromMutationResponse(data: unknown): RouteAssignment | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeApiRouteAssignment(data);
  }
  return null;
}

function extractCreatedRouteAssignmentId(response: ApiMutationEnvelope<unknown>): string | null {
  const data = response.data;

  if (typeof data === "string") {
    const id = data.trim();
    return id || null;
  }

  const assignment = extractRouteAssignmentFromMutationResponse(data);
  return assignment?.id ?? null;
}

async function resolveCreatedRouteAssignment(
  values: RouteAssignmentFormValues,
  response: ApiMutationEnvelope<unknown>,
): Promise<RouteAssignment> {
  const createdId = extractCreatedRouteAssignmentId(response);
  if (createdId) {
    return fetchRouteAssignmentById(createdId);
  }

  const assignment = extractRouteAssignmentFromMutationResponse(response.data);
  if (assignment) {
    return assignment;
  }

  const routeAssignmentId = values.routeAssignmentId.trim();
  if (routeAssignmentId) {
    const matches = await fetchRouteAssignments({
      page: 1,
      limit: 1,
      search: { field: "routeAssignmentId", operator: "eq", value: routeAssignmentId },
    });

    const matched = matches.items[0];
    if (matched) {
      return matched;
    }
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to create route assignment.");
}

export async function createRouteAssignment(
  values: RouteAssignmentFormValues,
): Promise<RouteAssignment> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.ROUTE_ASSIGNMENTS,
    buildRouteAssignmentWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create route assignment.");

  return resolveCreatedRouteAssignment(values, response);
}

export async function updateRouteAssignment(
  recordId: string,
  values: RouteAssignmentFormValues,
): Promise<RouteAssignment> {
  const id = recordId.trim();
  if (!id) {
    throw new Error("A valid route assignment id is required to update.");
  }

  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.ROUTE_ASSIGNMENTS}/${id}`,
    buildRouteAssignmentWritePayload(values, { recordId: id }),
  );

  assertMutationSuccess(response, "Unable to update route assignment.");

  return extractRouteAssignmentFromMutationResponse(response.data) ?? fetchRouteAssignmentById(id);
}

export async function deleteRouteAssignment(recordId: string): Promise<void> {
  const id = recordId.trim();
  if (!id) {
    throw new Error("A valid route assignment id is required to delete.");
  }

  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.ROUTE_ASSIGNMENTS}/${id}`,
  );

  assertMutationSuccess(response, "Unable to delete route assignment.");
}

export async function deleteRouteAssignments(recordIds: string[]): Promise<void> {
  await Promise.all(recordIds.map((id) => deleteRouteAssignment(id)));
}
