import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import type { ApiListSortInput } from "@/lib/api/list-query";
import { createApiListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";
import {
  createEmptyVehicleRef,
  employeeHasRole,
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

/** A scheduled route is tied to either a calendar date or a recurring weekday. */
export type RouteScheduleType = "date" | "dayOfWeek";

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export const DAYS_OF_WEEK: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

export type ActiveRouteContainerRef = {
  id: number;
  name: string;
};

export type ActiveRouteRouteRef = {
  id: string;
  name: string;
  routeId?: string;
};

export type ActiveRouteBranchRef = {
  id: number;
  code: string;
  name?: string;
};

export type ActiveRoute = {
  id: string;
  name: string;
  routeType: RouteType;
  container: ActiveRouteContainerRef | null;
  /** Calendar date (`YYYY-MM-DD`); empty when the route recurs on weekdays. */
  date: string;
  /** Recurring weekdays (`monday`..`sunday`); empty when the route uses a date. */
  dayOfWeek: string[];
  branch: ActiveRouteBranchRef | null;
  /** Optional truck leftover from older vehicle-route records. Daily routes do not collect this. */
  vehicle: RouteVehicleRef;
  active: boolean;
  route: ActiveRouteRouteRef;
  /** Crew members with their role (driver/appraiser/helper). */
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
  scheduleType: RouteScheduleType;
  date: string;
  dayOfWeek: string[];
  name: string;
  branch: ActiveRouteBranchRef;
  vehicle: RouteVehicleRef;
  container: ActiveRouteContainerRef | null;
  routeRecordId: string;
  /** Route manager assignment display name (sent as `route.name` on write). */
  routeAssignmentName: string;
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
};

export type ActiveRouteSearchFilter = ApiListTextSearch;

export const DEFAULT_ACTIVE_ROUTE_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: "date:desc",
} as const satisfies ActiveRouteListParams;

/**
 * Fields the bar search fans out across with an OR group (`POST /vehicle-routes/search`).
 * Must match the API search allowlist — crew names use `employees.name` (not driver/appraiser/
 * helper), and container uses `container.number` (not `container.name`).
 */
export const ACTIVE_ROUTE_BAR_OR_SEARCH_FIELDS = [
  "name",
  "route.name",
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

/** Crew members acting as appraiser. */
export function getActiveRouteAppraisers(
  record: Pick<ActiveRoute, "employees">,
): RouteEmployeeRef[] {
  return getActiveRouteEmployeesByRole(record, "appraiser");
}

/** First appraiser on the route, if any (legacy API denormalization). */
export function getActiveRouteAppraiser(
  record: Pick<ActiveRoute, "employees">,
): RouteEmployeeRef | null {
  return getActiveRouteAppraisers(record)[0] ?? null;
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

export function buildScheduledRouteFormValues(input: {
  routeType: RouteType;
  routeRecordId: string;
  routeAssignmentName: string;
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
    vehicle: isDelivery ? createEmptyVehicleRef() : { ...createEmptyVehicleRef(), ...input.vehicle },
    routeRecordId: input.routeRecordId.trim(),
    routeAssignmentName: input.routeAssignmentName.trim(),
    employees: input.employees.map((employee) => ({ ...employee })),
    container: isDelivery && input.container ? { ...input.container } : null,
    active: true,
  };
}

export function buildAppointmentRouteFormValues(input: {
  routeRecordId: string;
  routeAssignmentName: string;
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
    scheduleType: "date",
    date: todayDateInputValue(),
    dayOfWeek: [],
    name: "",
    branch: { id: 0, code: "" },
    vehicle: createEmptyVehicleRef(),
    container: null,
    routeRecordId: "",
    routeAssignmentName: "",
    employees: [],
    active: true,
    rate: "",
  };
}

export function activeRouteToFormValues(record: ActiveRoute): ActiveRouteFormValues {
  const scheduleType: RouteScheduleType = record.dayOfWeek.length > 0 ? "dayOfWeek" : "date";

  return {
    routeType: record.routeType,
    scheduleType,
    date: record.date ? toRouteDateInput(record.date) || record.date : todayDateInputValue(),
    dayOfWeek: [...record.dayOfWeek],
    name: record.name,
    branch: record.branch ? { ...record.branch } : { id: 0, code: "" },
    vehicle: { ...record.vehicle },
    container: record.container ? { ...record.container } : null,
    routeRecordId: record.route.id,
    routeAssignmentName: record.route.name,
    employees: record.employees.map((employee) => ({ ...employee })),
    active: record.active,
    rate: record.rate != null && Number.isFinite(record.rate) ? String(record.rate) : "",
  };
}

export function areActiveRouteFormValuesEquivalent(
  left: ActiveRouteFormValues,
  right: ActiveRouteFormValues,
): boolean {
  return areFormValuesEquivalent(left, right);
}


export function assertActiveRouteFormValues(values: ActiveRouteFormValues): void {
  // TODO(backend): reject a second daily route for the same date + branch so the
  // portal can reuse a previous configuration by changing only the date.
  if (values.scheduleType === "date" && !values.date.trim()) {
    throw new Error("Date is required.");
  }
  if (values.scheduleType === "dayOfWeek" && values.dayOfWeek.length === 0) {
    throw new Error("At least one day of week is required.");
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
  if (!values.routeRecordId.trim()) {
    throw new Error("Route is required.");
  }
}

export function readActiveRouteActorName(actor?: string | null): string {
  return actor?.trim() || DEFAULT_CREATED_BY;
}
