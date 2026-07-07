import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import type { ApiListSortInput } from "@/lib/api/list-query";
import type { ApiListTextSearch } from "@/lib/api/search-query";
import type { RouteCrewRole, RouteEmployeeRef } from "@/lib/route-manager/types";
import {
  employeeHasRole,
  todayDateInputValue,
  toRouteDateInput,
} from "@/lib/route-manager/types";

export type RouteType = "pickup" | "delivery";

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
  active: boolean;
  route: ActiveRouteRouteRef;
  /** Crew members with their role (driver/appraiser/helper). */
  employees: RouteEmployeeRef[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type ActiveRouteFormValues = {
  routeType: RouteType;
  scheduleType: RouteScheduleType;
  date: string;
  dayOfWeek: string[];
  name: string;
  branch: ActiveRouteBranchRef;
  container: ActiveRouteContainerRef | null;
  routeRecordId: string;
  /** Route manager assignment display name (sent as `route.name` on write). */
  routeAssignmentName: string;
  employees: RouteEmployeeRef[];
  active: boolean;
};

export type ActiveRouteLookupParams = {
  routeType: RouteType;
  date: string;
  containerId?: number;
};

export type ActiveRouteFilterState = {
  query: string;
};

export type ActiveRouteListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: ApiListTextSearch;
  routeType?: RouteType;
};

export type ActiveRouteSearchFilter = ApiListTextSearch;

export const DEFAULT_ACTIVE_ROUTE_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: "date:desc",
} as const satisfies ActiveRouteListParams;

/** Fields the bar search fans out across with an OR group (`POST /vehicle-routes/search`). */
export const ACTIVE_ROUTE_BAR_OR_SEARCH_FIELDS = [
  "name",
  "route.name",
  "driver.name",
  "appraiser.name",
  "helper.name",
  "employees.name",
  "container.name",
  "date",
] as const;

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

export function createEmptyActiveRouteForm(routeType: RouteType = "pickup"): ActiveRouteFormValues {
  return {
    routeType,
    scheduleType: "date",
    date: todayDateInputValue(),
    dayOfWeek: [],
    name: "",
    branch: { id: 0, code: "" },
    container: null,
    routeRecordId: "",
    routeAssignmentName: "",
    employees: [],
    active: true,
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
    container: record.container ? { ...record.container } : null,
    routeRecordId: record.route.id,
    routeAssignmentName: record.route.name,
    employees: record.employees.map((employee) => ({ ...employee })),
    active: record.active,
  };
}

export function assertActiveRouteFormValues(values: ActiveRouteFormValues): void {
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
