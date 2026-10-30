import type { ApiTableRecord } from "@/lib/table/api-table-fields";
import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import type { ApiListSortInput } from "@/lib/api/list-query";
import { createApiListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import {
  createEmptyVehicleRef,
  employeeHasRole,
  setVehicleRouteCrewRole,
  todayDateInputValue,
  toRouteDateInput,
  type RouteCrewRole,
  type RouteEmployeeRef,
  type RouteVehicleRef,
} from "@/lib/route-manager/types";

export type RouteType = "pickup" | "delivery";

/** Dominican Republic branch codes. Daily routes at these branches include container and rate. */
export const DELIVERY_BRANCH_CODES = ["RD", "DR", "DO"] as const;

export function isDeliveryBranchCode(code: string | null | undefined): boolean {
  const normalized = code?.trim().toUpperCase() ?? "";
  return (DELIVERY_BRANCH_CODES as readonly string[]).includes(normalized);
}

export function routeTypeForBranchCode(code: string | null | undefined): RouteType {
  return isDeliveryBranchCode(code) ? "delivery" : "pickup";
}

export type ActiveRouteContainerRef = {
  id: number;
  name: string;
};

export type ActiveRouteBranchRef = {
  id: number;
  code: string;
  name?: string;
};

export type ActiveRoute = ApiTableRecord & {
  id: string;
  name: string;
  routeType: RouteType;
  container: ActiveRouteContainerRef | null;
  /** Calendar date (`YYYY-MM-DD`). */
  date: string;
  branch: ActiveRouteBranchRef | null;
  vehicle: RouteVehicleRef;
  active: boolean;
  /** Crew members with their role (driver/supervisor/helper). */
  employees: RouteEmployeeRef[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  /** USD→DOP exchange rate for this delivery trip (delivery routes only). */
  rate?: number;
};

export type ActiveRouteFormValues = {
  routeType: RouteType;
  date: string;
  branch: ActiveRouteBranchRef;
  vehicle: RouteVehicleRef;
  container: ActiveRouteContainerRef | null;
  /** Route crew picked to prefill `employees`; never saved on the daily route. */
  routeRecordId: string;
  employees: RouteEmployeeRef[];
  active: boolean;
  /** DOP per USD for delivery trips; empty when unset. */
  rate: string;
};

export type ActiveRouteLookupParams = {
  routeType: RouteType;
  date: string;
  containerId?: number;
};

export type ActiveRouteFilterState = {
  query: string;
  rows: TableFilterRowState[];
};

export type ActiveRouteListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: ApiListTextSearch;
  filterRows?: TableFilterRowState[];
  /** Omit to list pickup and delivery daily routes together. */
  routeType?: RouteType;
  /** When set, scopes the list to `branch.code`. Empty/omitted lists every branch. */
  branchCode?: string;
  /** When set (`YYYY-MM-DD`), scopes the list to routes scheduled on that calendar day. */
  date?: string;
};

export type ActiveRouteSearchFilter = ApiListTextSearch;

export const DEFAULT_ACTIVE_ROUTE_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: "date:desc",
} as const satisfies ActiveRouteListParams;

/**
 * Fields the bar search fans out across with an OR group (`POST /vehicle-routes/search`).
 * Must match the API search allowlist — crew names use `employees.name` (not driver/supervisor/
 * helper), and container uses `container.number` (not `container.name`).
 */
export const ACTIVE_ROUTE_BAR_OR_SEARCH_FIELDS = [
  "name",
  "employees.name",
  "container.number",
  "date",
  "tripNumber",
] as const;

export function buildActiveRouteListParams(input: {
  page: number;
  limit?: number;
  query: string;
  rows: TableFilterRowState[];
  routeType?: RouteType;
  sort?: ApiListSortInput;
  branchCode?: string;
}): ActiveRouteListParams {
  const params: ActiveRouteListParams = {
    ...DEFAULT_ACTIVE_ROUTE_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.sort,
  };

  if (input.routeType) {
    params.routeType = input.routeType;
  }

  const branchCode = input.branchCode?.trim();
  if (branchCode) {
    params.branchCode = branchCode;
  }

  const search = createApiListTextSearch(input.query);
  if (search) {
    params.search = search;
  }

  const completeRows = input.rows.filter((row) => isCompleteFilterRow(row));
  if (completeRows.length > 0) {
    params.filterRows = completeRows;
  }

  return params;
}

export function deriveRouteType(container: ActiveRouteContainerRef | null): RouteType {
  return container && container.id > 0 ? "delivery" : "pickup";
}

/** Crew members acting as supervisor. */
export function getActiveRouteSupervisors(
  record: Pick<ActiveRoute, "employees">,
): RouteEmployeeRef[] {
  return getActiveRouteEmployeesByRole(record, "supervisor");
}

/** First supervisor on the route, if any (legacy API denormalization). */
export function getActiveRouteSupervisor(
  record: Pick<ActiveRoute, "employees">,
): RouteEmployeeRef | null {
  return getActiveRouteSupervisors(record)[0] ?? null;
}

/** Crew members acting as helper. */
export function getActiveRouteHelpers(
  record: Pick<ActiveRoute, "employees">,
): RouteEmployeeRef[] {
  return getActiveRouteEmployeesByRole(record, "helper");
}

/** Crew members with the given role. */
export function getActiveRouteEmployeesByRole(
  record: Pick<ActiveRoute, "employees">,
  role: RouteCrewRole,
): RouteEmployeeRef[] {
  return record.employees.filter((employee) => employeeHasRole(employee, role));
}

/** A daily route needs a driver and a supervisor; one employee may hold both. */
export function hasDailyRouteLeadRoles(employees: RouteEmployeeRef[]): boolean {
  return (["driver", "supervisor"] as const).every((role) =>
    employees.some((employee) => employeeHasRole(employee, role)),
  );
}

/**
 * Apply a hand-picked employee list. Newly added employees take whichever of
 * driver/supervisor is still unassigned, so a single employee covers both.
 */
export function applyDailyRouteEmployeeSelection(
  current: RouteEmployeeRef[],
  next: RouteEmployeeRef[],
): RouteEmployeeRef[] {
  const existingIds = new Set(current.map((employee) => employee.id));
  let employees = next;
  for (const added of next.filter((employee) => !existingIds.has(employee.id))) {
    for (const role of ["driver", "supervisor"] as const) {
      if (!employees.some((employee) => employeeHasRole(employee, role))) {
        employees = setVehicleRouteCrewRole(employees, added.id, role);
      }
    }
  }
  return employees;
}

export function buildScheduledRouteFormValues(input: {
  routeType: RouteType;
  routeRecordId: string;
  date: string;
  branch: ActiveRouteBranchRef;
  employees: RouteEmployeeRef[];
  container?: ActiveRouteContainerRef | null;
  vehicle?: RouteVehicleRef;
}): ActiveRouteFormValues {
  const isDelivery = input.routeType === "delivery";
  return {
    ...createEmptyActiveRouteForm(input.routeType),
    date: input.date.trim().slice(0, 10),
    branch: { ...input.branch },
    vehicle: { ...createEmptyVehicleRef(), ...input.vehicle },
    routeRecordId: input.routeRecordId.trim(),
    employees: input.employees.map((employee) => ({ ...employee })),
    container: isDelivery && input.container ? { ...input.container } : null,
    active: true,
  };
}

export function buildAppointmentRouteFormValues(input: {
  routeRecordId: string;
  date: string;
  branch: ActiveRouteBranchRef;
  employees: RouteEmployeeRef[];
  vehicle: RouteVehicleRef;
}): ActiveRouteFormValues {
  return buildScheduledRouteFormValues({
    ...input,
    routeType: "pickup",
  });
}

export function createEmptyActiveRouteForm(routeType: RouteType = "pickup"): ActiveRouteFormValues {
  return {
    routeType,
    date: todayDateInputValue(),
    branch: { id: 0, code: "" },
    vehicle: createEmptyVehicleRef(),
    container: null,
    routeRecordId: "",
    employees: [],
    active: true,
    rate: "",
  };
}

export function activeRouteToFormValues(record: ActiveRoute): ActiveRouteFormValues {
  return {
    routeType: record.routeType,
    date: record.date ? toRouteDateInput(record.date) || record.date : todayDateInputValue(),
    branch: record.branch ? { ...record.branch } : { id: 0, code: "" },
    vehicle: { ...record.vehicle },
    container: record.container ? { ...record.container } : null,
    routeRecordId: "",
    employees: record.employees.map((employee) => ({ ...employee })),
    active: record.active,
    rate: record.rate != null && Number.isFinite(record.rate) ? String(record.rate) : "",
  };
}

export function areActiveRouteFormValuesEquivalent(
  left: ActiveRouteFormValues,
  right: ActiveRouteFormValues,
): boolean {
  const withoutCrewTemplate = (values: ActiveRouteFormValues) => ({ ...values, routeRecordId: "" });
  return areFormValuesEquivalent(withoutCrewTemplate(left), withoutCrewTemplate(right));
}

export function assertActiveRouteFormValues(values: ActiveRouteFormValues): void {
  // The API enforces employee-set + vehicle + date uniqueness; see APP_CONTEXT.md.
  if (!values.date.trim()) {
    throw new Error("Date is required.");
  }
  if (!(values.branch.id > 0)) {
    throw new Error("Branch is required.");
  }
  if (values.routeType === "delivery" && (!values.container || values.container.id <= 0)) {
    throw new Error("A container is required for delivery routes.");
  }
  if (values.routeType === "pickup" && values.container) {
    throw new Error("Pickup routes cannot include a container.");
  }
  if (values.employees.length === 0) {
    throw new Error("Employees are required.");
  }
  if (!hasDailyRouteLeadRoles(values.employees)) {
    throw new Error("A driver and a supervisor are required.");
  }
}

export function readActiveRouteActorName(actor?: string | null): string {
  return actor?.trim() || DEFAULT_CREATED_BY;
}
