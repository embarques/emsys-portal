import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";

export type RoutePlaceKind = "city" | "state" | "zip" | "zip_range";

export type RouteBranch = "usa" | "dr";

export type RoutePlace = {
  id: string;
  kind: RoutePlaceKind;
  value: string;
};

export type RouteRecord = {
  routeId: string;
  name: string;
  branch: RouteBranch;
  createdAt: string;
  createdBy: string;
  places: RoutePlace[];
  updatedAt: string;
};

export type RoutePlaceFormValues = {
  id: string;
  kind: RoutePlaceKind;
  value: string;
};

export type RouteFormValues = {
  routeId: string;
  name: string;
  branch: RouteBranch;
  places: RoutePlaceFormValues[];
  createdBy: string;
};

export type RouteFilterState = {
  query: string;
  placeKind: RoutePlaceKind | "all";
  branch: RouteBranch | "all";
};

export const ROUTE_BRANCHES: { value: RouteBranch; label: string }[] = [
  { value: "usa", label: "USA" },
  { value: "dr", label: "DR" },
];

export const ROUTE_PLACE_KINDS: { value: RoutePlaceKind; label: string; placeholder: string }[] = [
  { value: "city", label: "City", placeholder: "Brooklyn" },
  { value: "state", label: "State", placeholder: "NY" },
  { value: "zip", label: "Zip code", placeholder: "11201" },
  { value: "zip_range", label: "Zip range", placeholder: "10001-10010" },
];

export function createRecordId(): string {
  return crypto.randomUUID();
}

export function createRouteId(): string {
  return createRecordId();
}

export function createEmptyPlace(): RoutePlaceFormValues {
  return { id: createRecordId(), kind: "city", value: "" };
}

export function createEmptyRouteForm(): RouteFormValues {
  return {
    routeId: createRouteId(),
    name: "",
    branch: "usa",
    places: [createEmptyPlace()],
    createdBy: DEFAULT_CREATED_BY,
  };
}

export function routeToFormValues(route: RouteRecord): RouteFormValues {
  return {
    routeId: route.routeId,
    name: route.name,
    branch: route.branch,
    places:
      route.places.length > 0
        ? route.places.map((place) => ({
            id: place.id,
            kind: place.kind,
            value: place.value,
          }))
        : [createEmptyPlace()],
    createdBy: route.createdBy,
  };
}

function normalizePlaces(places: RoutePlaceFormValues[]): RoutePlace[] {
  return places
    .map((place) => ({
      id: place.id,
      kind: place.kind,
      value: place.value.trim(),
    }))
    .filter((place) => place.value.length > 0);
}

export function formValuesToRoute(
  values: RouteFormValues,
  createdAt?: string,
  createdBy?: string,
  updatedAt?: string
): RouteRecord {
  const places = normalizePlaces(values.places);

  if (places.length === 0) {
    throw new Error("At least one route place is required.");
  }

  return {
    routeId: values.routeId,
    name: values.name.trim(),
    branch: values.branch,
    createdAt: createdAt ?? new Date().toISOString(),
    createdBy: createdBy ?? (values.createdBy.trim() || DEFAULT_CREATED_BY),
    places,
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
}
