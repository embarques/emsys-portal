import { ACTIVE_ROUTE_API_TABLE_FIELDS } from "@/lib/pickup-delivery-routes/table-fields";
import { captureApiTableFields, readApiUserUsername } from "@/lib/table/api-table-fields";
import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import {
  runSettledIdsWithConcurrency,
  type BulkSettledResult,
} from "@/lib/api/run-settled-with-concurrency";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import { buildApiListQuery } from "@/lib/api/list-query";
import {
  buildApiSearchPaginationQuery,
  buildResourceSearchFilterGroups,
  buildStripeStyleSearchBody,
  coerceTypedFilterNode,
  type ApiSearchFilterGroup,
  type ApiSearchFilterNode,
} from "@/lib/api/search-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { resolvePaginatedListTotal } from "@/lib/api/types";
import {
  ACTIVE_ROUTE_BOOLEAN_FIELDS,
  ACTIVE_ROUTE_NUMERIC_FIELDS,
  getActiveRouteTableFilterFields,
} from "@/lib/pickup-delivery-routes/filter-fields";
import type { VehicleRouteWritePayload } from "@/lib/pickup-delivery-routes/api-schemas";
import { buildApiBranchDto } from "@/lib/api/payloads";
import {
  assertActiveRouteFormValues,
  DEFAULT_ACTIVE_ROUTE_LIST_PARAMS,
  ACTIVE_ROUTE_BAR_OR_SEARCH_FIELDS,
  deriveRouteType,
  getActiveRouteSupervisor,
  getActiveRouteEmployeesByRole,
  type ActiveRoute,
  type ActiveRouteFormValues,
  type ActiveRouteListParams,
  type ActiveRouteLookupParams,
  type RouteType,
} from "@/lib/pickup-delivery-routes/types";
import {
  DEFAULT_ROUTE_CREW_ROLE,
  getEmployeeRoles,
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
  branch?: string;
};

type ApiContainerRef = {
  id?: string | number;
  name?: string;
  number?: string;
};

type ApiBranchRef = {
  id?: string | number;
  code?: string;
  name?: string;
};

type ApiEmployeeRef = {
  id?: string | number;
  name?: string;
  role?: string;
};

type ApiVehicleRoute = {
  id?: string | number;
  _id?: string | number;
  name?: string;
  routeType?: string;
  active?: boolean;
  date?: string;
  branch?: ApiBranchRef | null;
  vehicle?: ApiRef | null;
  container?: ApiContainerRef | null;
  driver?: ApiEmployeeRef | null;
  supervisor?: ApiEmployeeRef | null;
  helpers?: ApiEmployeeRef[] | null;
  employees?: ApiEmployeeRef[] | null;
  rate?: number | string | null;
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

const VEHICLE_ROUTE_BAR_OR_SEARCH_FIELDS = ACTIVE_ROUTE_BAR_OR_SEARCH_FIELDS;

function expandActiveRouteFilterNode(node: ApiSearchFilterNode) {
  return coerceTypedFilterNode(node, {
    numericFields: ACTIVE_ROUTE_NUMERIC_FIELDS,
    booleanFields: ACTIVE_ROUTE_BOOLEAN_FIELDS,
  });
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

function normalizeCrewRole(raw: unknown): RouteCrewRole {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "driver" || value === "supervisor" || value === "helper") return value;
  return DEFAULT_ROUTE_CREW_ROLE;
}

function normalizeEmployeeRef(
  raw?: ApiEmployeeRef | null,
  fallbackRole?: RouteCrewRole,
): ActiveRoute["employees"][number] | null {
  if (!raw || typeof raw !== "object") return null;
  const id = Number(raw.id);
  const name = String(raw.name ?? "").trim();
  if (!Number.isInteger(id) || id <= 0 || !name) return null;
  return { id, name, role: normalizeCrewRole(raw.role ?? fallbackRole) };
}

function normalizeEmployees(raw?: ApiEmployeeRef[] | null): ActiveRoute["employees"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => normalizeEmployeeRef(entry))
    .filter((employee): employee is NonNullable<typeof employee> => employee != null);
}

function normalizeVehicleRouteCrew(item: ApiVehicleRoute): ActiveRoute["employees"] {
  const driver = normalizeEmployeeRef(item.driver, "driver");
  const supervisor = normalizeEmployeeRef(item.supervisor, "supervisor");
  // Explicit role fields are authoritative; fall back only for older responses.
  if (item.driver !== undefined || item.supervisor !== undefined || item.helpers !== undefined) {
    const crew: ActiveRoute["employees"] = [];
    if (driver && supervisor && driver.id === supervisor.id) {
      crew.push(toEmployeeWithRoles(driver, ["driver", "supervisor"]));
    } else {
      if (supervisor) crew.push(supervisor);
      if (driver) crew.push(driver);
    }
    const helpers = item.helpers !== undefined
      ? normalizeEmployees(item.helpers).map((employee) => ({ ...employee, role: "helper" as const }))
      : normalizeEmployees(item.employees).filter((employee) => employee.role === "helper");
    for (const helper of helpers) {
      if (!crew.some((employee) => employee.id === helper.id)) crew.push(helper);
    }
    return crew;
  }
  return normalizeEmployees(item.employees);
}

function toEmployeeWithRoles(
  employee: Pick<ActiveRoute["employees"][number], "id" | "name">,
  roles: RouteCrewRole[],
): ActiveRoute["employees"][number] {
  const unique = [...new Set(roles)];
  if (unique.length === 1) {
    return { id: employee.id, name: employee.name, role: unique[0] };
  }
  const primary = unique.includes("driver") ? "driver" : unique.includes("supervisor") ? "supervisor" : "helper";
  return { id: employee.id, name: employee.name, role: primary, roles: unique };
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
  const name = String(raw.name ?? "").trim();
  if (!Number.isInteger(id) || id <= 0) return null;
  return { id, code, ...(name ? { name } : {}) };
}

function normalizeVehicleRef(raw?: ApiRef | null): ActiveRoute["vehicle"] {
  const ref = raw ?? {};
  const branch = String(ref.branch ?? "").trim();
  return {
    id: String(ref.id ?? "").trim(),
    name: String(ref.name ?? "").trim(),
    ...(branch ? { branch } : {}),
  };
}

function normalizeRateValue(raw: unknown): number | undefined {
  if (raw == null || raw === "") return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseActiveRouteRateInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

function normalizeAuditFields(item: ApiVehicleRoute) {
  return {
    createdAt: String(item.createdAt ?? "").trim(),
    createdBy: readUserName(item.createdBy) || DEFAULT_CREATED_BY,
    updatedAt: String(item.updatedAt ?? "").trim(),
    updatedBy: readApiUserUsername(item.updatedBy) || "",
  };
}

export function normalizeApiVehicleRoute(raw: unknown): ActiveRoute | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiVehicleRoute;
  const id = String(item.id ?? item._id ?? "").trim();
  if (!id) return null;

  const container = normalizeContainerRef(item.container);
  const rawType = String(item.routeType ?? "").trim().toLowerCase();
  const routeType: RouteType =
    rawType === "pickup" || rawType === "delivery" ? rawType : deriveRouteType(container);

  const dateRaw = String(item.date ?? "").trim();

  return {
    ...captureApiTableFields(raw, ACTIVE_ROUTE_API_TABLE_FIELDS),
    id,
    name: String(item.name ?? "").trim(),
    routeType,
    container,
    date: dateRaw.includes("T") ? dateRaw.slice(0, 10) : dateRaw,
    branch: normalizeBranchRef(item.branch),
    vehicle: normalizeVehicleRef(item.vehicle),
    active: item.active !== false,
    employees: normalizeVehicleRouteCrew(item),
    rate: normalizeRateValue(item.rate),
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
  return values.employees.map((employee) => {
    const roles = getEmployeeRoles(employee);
    const role = roles.includes("driver")
      ? "driver"
      : roles.includes("supervisor")
        ? "supervisor"
        : resolveCrewRole(employee.role);
    return {
      id: employee.id,
      name: employee.name.trim(),
      role,
    };
  });
}

function buildVehicleRouteWritePayload(values: ActiveRouteFormValues): VehicleRouteWritePayload {
  assertActiveRouteFormValues(values);

  const employees = buildEmployeeWriteRefs(values);
  const driver = getActiveRouteEmployeesByRole(values, "driver")[0];
  const supervisor = getActiveRouteSupervisor(values);
  if (!driver || !supervisor) {
    throw new Error("A driver and a supervisor are required.");
  }

  const payload: VehicleRouteWritePayload = {
    routeType: values.routeType,
    active: true,
    branch: buildApiBranchDto({
      id: values.branch.id,
      code: values.branch.code.trim(),
      name: values.branch.name?.trim(),
    }),
    employees,
    helpers: employees.filter((employee) => employee.role === "helper").map(({ id, name }) => ({ id, name })),
    driver: { id: driver.id, name: driver.name.trim() },
    supervisor: { id: supervisor.id, name: supervisor.name.trim() },
    date: toRouteDateIso(values.date),
  };

  if (values.routeType === "delivery" && values.container && values.container.id > 0) {
    payload.container = {
      id: values.container.id,
      number: values.container.name.trim(),
    };
    const rate = parseActiveRouteRateInput(values.rate);
    if (rate != null) {
      payload.rate = rate;
    }
  }

  const vehicleId = values.vehicle.id.trim();
  if (vehicleId) {
    const vehicleName = values.vehicle.name.trim();
    const vehicleBranch = values.vehicle.branch?.trim();
    payload.vehicle = {
      id: vehicleId,
      name: vehicleName || vehicleId,
      ...(vehicleBranch ? { branch: vehicleBranch } : {}),
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

function buildVehicleRouteSearchBody(params: ActiveRouteListParams) {
  const tableFilterFields = getActiveRouteTableFilterFields(params.routeType);
  const branchCode = params.branchCode?.trim();
  const date = params.date?.trim().slice(0, 10);
  const filterGroups: ApiSearchFilterGroup[] = [
    ...(params.routeType ? [routeTypeFilterGroup(params.routeType)] : []),
    ...(branchCode
      ? [
          {
            operator: "and" as const,
            filters: [{ field: "branch.code", operator: "eq" as const, value: branchCode }],
          },
        ]
      : []),
    ...(date ? [{ operator: "and" as const, filters: buildDayRangeFilters(date) }] : []),
    ...buildResourceSearchFilterGroups({
      search: params.search,
      barOrSearchFields: VEHICLE_ROUTE_BAR_OR_SEARCH_FIELDS,
      filterRows: params.filterRows,
      tableFilterFields,
      expandNode: expandActiveRouteFilterNode,
    }),
  ];

  return buildStripeStyleSearchBody({
    sort: params.sort ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.sort,
    filterGroups,
  });
}

export async function fetchActiveRoutes(
  params: ActiveRouteListParams = {},
): Promise<PaginatedResult<ActiveRoute>> {
  const page = params.page ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.limit;

  // Shared endpoint always uses POST /search so we can optionally scope by routeType.
  const isFiltered = true;

  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.VEHICLE_ROUTES,
    page,
    limit,
    offset: params.offset,
    isFiltered,
    buildGetQuery: () =>
      buildApiListQuery({
        page,
        limit,
        offset: params.offset,
        sort: params.sort ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.sort,
      }),
    buildSearchBody: () => buildVehicleRouteSearchBody(params),
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

  const filters = [...buildDayRangeFilters(isoDate)];
  if (params.routeType === "delivery" && params.containerId) {
    filters.push({ field: "container.id", operator: "eq", value: String(params.containerId) });
  }
  filters.push({ field: "routeType", operator: "eq", value: params.routeType });

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

/** Pickup daily routes dated `date` whose crew includes `employeeId`. */
export async function fetchPickupDailyRoutesForEmployee(
  employeeId: number,
  date: string,
): Promise<ActiveRoute[]> {
  const isoDate = date.trim().slice(0, 10);
  if (!isoDate || !Number.isInteger(employeeId) || employeeId <= 0) return [];

  const searchBody = buildStripeStyleSearchBody({
    sort: { field: "date", direction: "desc" },
    filterGroups: [
      {
        operator: "and",
        filters: [
          ...buildDayRangeFilters(isoDate),
          { field: "routeType", operator: "eq", value: "pickup" },
        ],
      },
    ],
  });
  const paginationQuery = buildApiSearchPaginationQuery({ page: 1, limit: 100, offset: 0 });
  const payload = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.VEHICLE_ROUTES}/search?${paginationQuery}`,
    searchBody,
  );

  const items = Array.isArray(payload.data) ? payload.data : [];
  return items
    .map((row) => normalizeApiVehicleRoute(row))
    .filter(
      (record): record is ActiveRoute =>
        record != null && record.employees.some((member) => member.id === employeeId),
    );
}

function toEmployeeIdSetKey(employeeIds: readonly number[]): string {
  return [...new Set(employeeIds)].sort((left, right) => left - right).join(",");
}

/** Daily route on `date` whose employees are exactly `employeeIds` (order-independent). */
export async function fetchVehicleRouteByEmployeesAndDate(input: {
  employeeIds: readonly number[];
  date: string;
  routeType: RouteType;
  containerId?: number;
  vehicleId?: string;
}): Promise<ActiveRoute | null> {
  const employeeSetKey = toEmployeeIdSetKey(input.employeeIds);
  const isoDate = input.date.trim().slice(0, 10);
  const vehicleId = input.vehicleId?.trim() ?? "";
  if (!employeeSetKey || !isoDate) return null;
  if (input.routeType === "delivery" && !(input.containerId && input.containerId > 0)) {
    return null;
  }

  const filters = [
    ...buildDayRangeFilters(isoDate),
    { field: "routeType", operator: "eq" as const, value: input.routeType },
    { field: "employees.id", operator: "eq" as const, value: String(input.employeeIds[0]) },
  ];
  if (input.routeType === "delivery" && input.containerId) {
    filters.push({
      field: "container.id",
      operator: "eq",
      value: String(input.containerId),
    });
  }
  if (input.routeType === "pickup" && vehicleId) {
    filters.push({
      field: "vehicle.id",
      operator: "eq",
      value: vehicleId,
    });
  }

  const searchBody = buildStripeStyleSearchBody({
    sort: { field: "date", direction: "desc" },
    filterGroups: [{ operator: "and", filters }],
  });

  const paginationQuery = buildApiSearchPaginationQuery({ page: 1, limit: 20, offset: 0 });
  const payload = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.VEHICLE_ROUTES}/search?${paginationQuery}`,
    searchBody,
  );

  const items = Array.isArray(payload.data) ? payload.data : [];
  for (const row of items) {
    const record = normalizeApiVehicleRoute(row);
    if (!record || record.routeType !== input.routeType) continue;
    if (toEmployeeIdSetKey(record.employees.map((employee) => employee.id)) !== employeeSetKey) continue;
    if (!(record.date === isoDate || record.date.startsWith(isoDate))) continue;
    if (input.routeType === "delivery" && record.container?.id !== input.containerId) continue;
    if (input.routeType === "pickup" && vehicleId && record.vehicle.id !== vehicleId) continue;
    return record;
  }

  return null;
}

export async function fetchActiveRoute(
  params: ActiveRouteLookupParams,
): Promise<ActiveRoute | null> {
  const date = params.date.trim().slice(0, 10);
  if (!date) return null;
  if (params.routeType === "delivery" && !params.containerId) return null;

  return searchActiveRouteByLookup({ ...params, date });
}

export async function fetchActiveRouteById(
  recordId: string,
  _routeType?: RouteType,
): Promise<ActiveRoute> {
  const id = recordId.trim();
  if (!id) {
    throw new Error("A valid route id is required.");
  }

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
    return fetchActiveRouteById(recordId);
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to save route.");
}

export async function createActiveRoute(values: ActiveRouteFormValues): Promise<ActiveRoute> {
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
  const recordId = existingId?.trim();
  if (recordId) {
    return updateActiveRoute(recordId, values);
  }

  return createActiveRoute(values);
}

export async function deleteActiveRoute(recordId: string, _routeType?: RouteType): Promise<void> {
  const id = recordId.trim();
  if (!id) {
    throw new Error("A valid route id is required to delete.");
  }

  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.VEHICLE_ROUTES}/${id}`,
  );

  assertMutationSuccess(response, "Unable to delete route.");
}

export async function deleteActiveRoutes(
  recordIds: string[],
  routeType?: RouteType,
): Promise<BulkSettledResult<string>> {
  const uniqueIds = [...new Set(recordIds.map((id) => id.trim()).filter(Boolean))];
  return runSettledIdsWithConcurrency(uniqueIds, (id) => deleteActiveRoute(id, routeType));
}
