import type { PaginatedResult } from "@/lib/api/types";
import {
  cloneRoutes,
  createRouteInStore,
  deleteRoutesFromStore,
  getRouteByRecordId,
  updateRouteInStore,
} from "@/lib/routes/mock-data";
import {
  computeRouteKpis,
  routeMatchesQuery,
  routeMatchesSearch,
} from "@/lib/routes/display";
import {
  DEFAULT_ROUTE_LIST_PARAMS,
  type Route,
  type RouteFormValues,
  type RouteListParams,
} from "@/lib/routes/types";

const MOCK_LATENCY_MS = 120;

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
}

function paginateRoutes(items: Route[], params: RouteListParams): PaginatedResult<Route> {
  const page = params.page ?? DEFAULT_ROUTE_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_ROUTE_LIST_PARAMS.limit;
  const start = (page - 1) * limit;
  const slice = items.slice(start, start + limit);

  return {
    items: slice,
    page,
    resultsPerPage: limit,
    total: items.length,
  };
}

function filterRoutes(params: RouteListParams): Route[] {
  let items = cloneRoutes();

  const search = params.search;
  if (search?.value.trim()) {
    const searchField = search.field;
    if (searchField) {
      items = items.filter((route) =>
        routeMatchesSearch(route, {
          field: searchField,
          operator: search.operator ?? "contains",
          value: search.value,
        }),
      );
    } else {
      items = items.filter((route) => routeMatchesQuery(route, search.value));
    }
  }

  const sort = params.sort ?? DEFAULT_ROUTE_LIST_PARAMS.sort;
  const sortSpec =
    typeof sort === "string"
      ? { field: sort.split(":")[0] ?? "name", direction: sort.split(":")[1] ?? "asc" }
      : Array.isArray(sort)
        ? sort[0]
        : sort;
  const field = sortSpec?.field ?? "name";
  const direction = sortSpec?.direction ?? "asc";
  const multiplier = direction === "desc" ? -1 : 1;

  items.sort((left, right) => {
    const compare = (() => {
      switch (field) {
        case "name":
          return left.name.localeCompare(right.name);
        case "routeId":
          return left.routeId.localeCompare(right.routeId);
        case "date":
          return left.date.localeCompare(right.date);
        case "createdAt":
          return left.createdAt.localeCompare(right.createdAt);
        default:
          return left.name.localeCompare(right.name);
      }
    })();
    return compare * multiplier;
  });

  return items;
}

export async function fetchRoutes(params: RouteListParams = {}): Promise<PaginatedResult<Route>> {
  await delay();
  return paginateRoutes(filterRoutes(params), params);
}

export async function fetchRoutesByDate(_dateInput: string): Promise<PaginatedResult<Route>> {
  await delay();
  const items = cloneRoutes();
  const kpis = computeRouteKpis(items);
  return {
    items,
    page: 1,
    resultsPerPage: items.length,
    total: kpis.total,
  };
}

export async function fetchRouteById(routeId: string): Promise<Route> {
  await delay();
  const id = routeId.trim();
  const route = getRouteByRecordId(id);
  if (!route) {
    throw new Error("Route not found.");
  }
  return route;
}

export async function createRoute(values: RouteFormValues): Promise<Route> {
  await delay();
  return createRouteInStore(values);
}

export async function updateRoute(recordId: string, values: RouteFormValues): Promise<Route> {
  await delay();
  return updateRouteInStore(recordId, values);
}

export async function deleteRoute(recordId: string): Promise<void> {
  await delay();
  deleteRoutesFromStore([recordId]);
}

export async function deleteRoutes(recordIds: string[]): Promise<void> {
  await delay();
  deleteRoutesFromStore(recordIds);
}

export async function assignPickupsToRoute(_routeId: string, _pickupIds: number[]): Promise<void> {
  await delay();
}
