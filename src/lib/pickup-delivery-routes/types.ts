import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import type { ApiListSortInput } from "@/lib/api/list-query";
import type { ApiListTextSearch } from "@/lib/api/search-query";
import type { RouteEmployeeRef } from "@/lib/route-manager/types";
import { todayDateInputValue, toRouteDateInput } from "@/lib/route-manager/types";

export type RouteType = "pickup" | "delivery";

export type ActiveRouteContainerRef = {
  id: number;
  name: string;
};

export type ActiveRouteRouteRef = {
  id: string;
  name: string;
  routeId?: string;
};

export type ActiveRoute = {
  id: string;
  name: string;
  routeType: RouteType;
  container: ActiveRouteContainerRef | null;
  /** Calendar date (`YYYY-MM-DD`) for forms and display. */
  date: string;
  route: ActiveRouteRouteRef;
  driver: RouteEmployeeRef | null;
  appraiser: RouteEmployeeRef | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type ActiveRouteFormValues = {
  routeType: RouteType;
  container: ActiveRouteContainerRef | null;
  date: string;
  routeRecordId: string;
  driver: RouteEmployeeRef | null;
  appraiser: RouteEmployeeRef | null;
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

/** Fields the bar search fans out across with an OR group. */
export const ACTIVE_ROUTE_BAR_OR_SEARCH_FIELDS = [
  "name",
  "route.name",
  "driver.name",
  "appraiser.name",
  "container.name",
  "date",
] as const;

export function deriveRouteType(container: ActiveRouteContainerRef | null): RouteType {
  return container && container.id > 0 ? "delivery" : "pickup";
}

export function createEmptyActiveRouteForm(routeType: RouteType = "pickup"): ActiveRouteFormValues {
  return {
    routeType,
    container: null,
    date: todayDateInputValue(),
    routeRecordId: "",
    driver: null,
    appraiser: null,
  };
}

export function activeRouteToFormValues(record: ActiveRoute): ActiveRouteFormValues {
  return {
    routeType: record.routeType,
    container: record.container ? { ...record.container } : null,
    date: toRouteDateInput(record.date) || record.date,
    routeRecordId: record.route.id,
    driver: record.driver ? { ...record.driver } : null,
    appraiser: record.appraiser ? { ...record.appraiser } : null,
  };
}

export function assertActiveRouteFormValues(values: ActiveRouteFormValues): void {
  if (!values.date.trim()) {
    throw new Error("Date is required.");
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
