import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import { createRandomId } from "@/lib/utils/id";

export type RoutePlaceKind = "city" | "state" | "zip" | "zip_range";

/** City entry on a pickup route — `{ cityName, stateCode }`. */
export type RouteCity = {
  cityName: string;
  stateCode: string;
};

/** Inclusive zip range on a pickup route — `{ start, end }`. */
export type RouteZipRange = {
  start: string;
  end: string;
};

/** EMSYS pickup route from GET /pickups/route. */
export type RouteRecord = {
  /** API `id` field. */
  routeId: string;
  name: string;
  cities: RouteCity[];
  states: string[];
  zipCodes: string[];
  zipRanges: RouteZipRange[];
  createdAt: string;
  updatedAt: string;
};

export type RouteCityFormValues = {
  id: string;
  cityName: string;
  stateCode: string;
};

export type RouteStateFormValues = {
  id: string;
  value: string;
};

export type RouteZipCodeFormValues = {
  id: string;
  value: string;
};

export type RouteZipRangeFormValues = {
  id: string;
  start: string;
  end: string;
};

export type RouteFormValues = {
  routeId: string;
  name: string;
  cities: RouteCityFormValues[];
  states: RouteStateFormValues[];
  zipCodes: RouteZipCodeFormValues[];
  zipRanges: RouteZipRangeFormValues[];
};

export type RouteSearchFilter = ApiListTextSearch;

export type RouteFilterState = {
  query: string;
};

export type RouteListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: RouteSearchFilter;
};

/** GET /pickups/route?page=1&limit=40&offset=0&sort=name:asc */
export const DEFAULT_ROUTE_LIST_PARAMS = {
  page: 1,
  limit: 40,
  sort: "name:asc",
} as const satisfies Pick<RouteListParams, "page" | "limit" | "sort">;

export const ROUTE_PLACE_KINDS: { value: RoutePlaceKind; label: string }[] = [
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "zip", label: "Zip code" },
  { value: "zip_range", label: "Zip range" },
];

function createRowId(): string {
  return createRandomId();
}

export function createEmptyCity(): RouteCityFormValues {
  return { id: createRowId(), cityName: "", stateCode: "" };
}

export function createEmptyState(): RouteStateFormValues {
  return { id: createRowId(), value: "" };
}

export function createEmptyZipCode(): RouteZipCodeFormValues {
  return { id: createRowId(), value: "" };
}

export function createEmptyZipRange(): RouteZipRangeFormValues {
  return { id: createRowId(), start: "", end: "" };
}

export function createEmptyRouteForm(): RouteFormValues {
  return {
    routeId: "",
    name: "",
    cities: [createEmptyCity()],
    states: [],
    zipCodes: [],
    zipRanges: [],
  };
}

export function routeToFormValues(route: RouteRecord): RouteFormValues {
  return {
    routeId: route.routeId,
    name: route.name,
    cities:
      route.cities.length > 0
        ? route.cities.map((city) => ({ id: createRowId(), cityName: city.cityName, stateCode: city.stateCode }))
        : [createEmptyCity()],
    states: route.states.map((value) => ({ id: createRowId(), value })),
    zipCodes: route.zipCodes.map((value) => ({ id: createRowId(), value })),
    zipRanges: route.zipRanges.map((range) => ({ id: createRowId(), start: range.start, end: range.end })),
  };
}

export function countRouteFormEntries(values: RouteFormValues): number {
  const cities = values.cities.filter((city) => city.cityName.trim()).length;
  const states = values.states.filter((state) => state.value.trim()).length;
  const zipCodes = values.zipCodes.filter((zip) => zip.value.trim()).length;
  const zipRanges = values.zipRanges.filter((range) => range.start.trim() && range.end.trim()).length;
  return cities + states + zipCodes + zipRanges;
}

export function createRouteSearchFilter(value: string): RouteSearchFilter | undefined {
  return createListTextSearch(value);
}

export function buildRouteListParams(input: {
  page: number;
  limit?: number;
  query: string;
  sort?: ApiListSortInput;
}): RouteListParams {
  const params: RouteListParams = {
    ...DEFAULT_ROUTE_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_ROUTE_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_ROUTE_LIST_PARAMS.sort,
  };

  const search = createRouteSearchFilter(input.query);
  if (search) {
    params.search = search;
  }

  return params;
}

export function validateRouteFormValues(values: RouteFormValues): void {
  if (!values.name.trim()) {
    throw new Error("Route name is required.");
  }

  if (countRouteFormEntries(values) === 0) {
    throw new Error("Add at least one city, state, zip code, or zip range.");
  }
}
