import type { RouteRecord } from "./types";

export const MOCK_ROUTES: RouteRecord[] = [
  {
    routeId: "rte-001",
    name: "Brooklyn — Manhattan Express",
    branch: "usa",
    createdAt: "2026-01-15T10:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T14:22:00Z",
    places: [
      { id: "pl-001", kind: "city", value: "Brooklyn" },
      { id: "pl-002", kind: "city", value: "Manhattan" },
      { id: "pl-003", kind: "zip", value: "11201" },
    ],
  },
  {
    routeId: "rte-002",
    name: "NY State North",
    branch: "usa",
    createdAt: "2026-02-03T09:30:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-03T11:05:00Z",
    places: [
      { id: "pl-004", kind: "state", value: "NY" },
      { id: "pl-005", kind: "zip_range", value: "10001-10282" },
    ],
  },
  {
    routeId: "rte-003",
    name: "Santo Domingo Metro",
    branch: "dr",
    createdAt: "2026-02-20T14:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-02T18:40:00Z",
    places: [
      { id: "pl-006", kind: "city", value: "Santo Domingo" },
      { id: "pl-007", kind: "zip", value: "10210" },
      { id: "pl-008", kind: "zip", value: "10107" },
    ],
  },
  {
    routeId: "rte-004",
    name: "Florida Doral Hub",
    branch: "usa",
    createdAt: "2026-03-10T08:15:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-01T09:15:00Z",
    places: [
      { id: "pl-009", kind: "state", value: "FL" },
      { id: "pl-010", kind: "city", value: "Doral" },
      { id: "pl-011", kind: "zip_range", value: "33122-33178" },
    ],
  },
  {
    routeId: "rte-005",
    name: "Santiago Interior",
    branch: "dr",
    createdAt: "2026-04-05T16:45:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-05-30T16:30:00Z",
    places: [
      { id: "pl-012", kind: "city", value: "Santiago" },
      { id: "pl-013", kind: "zip_range", value: "51000-51100" },
    ],
  },
];

export function cloneRoutes(): RouteRecord[] {
  return MOCK_ROUTES.map((route) => ({
    ...route,
    places: route.places.map((place) => ({ ...place })),
  }));
}

export function getRouteById(routeId: string): RouteRecord | undefined {
  return MOCK_ROUTES.find((route) => route.routeId === routeId);
}
