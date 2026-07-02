import type { Route, RouteFormValues } from "./types";
import { formValuesToRoute, generateRouteNumber } from "./types";
import {
  clearBrowserStore,
  readBrowserStore,
  writeBrowserStore,
} from "@/lib/local-dev/browser-store";
import { createMockObjectId } from "@/lib/vehicles/types";

const LOCAL_ROUTES_STORAGE_KEY = "emsys-local-routes";

/** @deprecated Empty — local dev store starts blank and persists in localStorage. */
export const MOCK_ROUTES: Route[] = [];

function buildMockRouteName(employees: Route["employees"], vehicleName: string): string {
  const parts = employees.map((employee) => employee.name.trim()).filter(Boolean);
  if (vehicleName.trim()) parts.push(vehicleName.trim());
  return parts.join("-") || "Route";
}

function cloneAssignment(assignment: Route): Route {
  return {
    ...assignment,
    vehicle: { ...assignment.vehicle },
    employees: assignment.employees.map((employee) => ({ ...employee })),
  };
}

let routesStore: Route[] | null = null;

function ensureRoutesStore(): Route[] {
  if (routesStore === null) {
    routesStore = readBrowserStore<Route>(LOCAL_ROUTES_STORAGE_KEY)
      .filter((assignment): assignment is Route =>
        Boolean(assignment && typeof assignment === "object" && assignment.id),
      )
      .map(cloneAssignment);
  }
  return routesStore;
}

function commitRoutesStore(next: Route[]): void {
  routesStore = next.map(cloneAssignment);
  writeBrowserStore(LOCAL_ROUTES_STORAGE_KEY, routesStore);
}

export function cloneRoutes(): Route[] {
  return ensureRoutesStore().map(cloneAssignment);
}

export function setRoutesStore(assignments: Route[]): void {
  commitRoutesStore(assignments);
}

export function resetRoutesStore(): void {
  routesStore = [];
  clearBrowserStore(LOCAL_ROUTES_STORAGE_KEY);
}

export function getRouteById(routeId: string): Route | undefined {
  return ensureRoutesStore().find((assignment) => assignment.routeId === routeId);
}

export function getRouteByRecordId(id: string): Route | undefined {
  return ensureRoutesStore().find((assignment) => assignment.id === id);
}

export function createRouteInStore(values: RouteFormValues, createdBy?: string): Route {
  const now = new Date().toISOString();
  const route = formValuesToRoute(
    {
      ...values,
      routeId: generateRouteNumber(),
      name: buildMockRouteName(values.employees, values.vehicle.name),
      createdBy: values.createdBy || createdBy || "Local User",
      updatedBy: values.updatedBy || createdBy || "Local User",
    },
    now,
    now,
    createMockObjectId(),
  );
  commitRoutesStore([route, ...ensureRoutesStore()]);
  return cloneAssignment(route);
}

export function updateRouteInStore(recordId: string, values: RouteFormValues): Route {
  const store = ensureRoutesStore();
  const index = store.findIndex((assignment) => assignment.id === recordId);
  if (index < 0) {
    throw new Error("Route not found.");
  }

  const existing = store[index];
  const now = new Date().toISOString();
  const updated = formValuesToRoute(
    {
      ...values,
      name: buildMockRouteName(values.employees, values.vehicle.name),
    },
    existing.createdAt,
    now,
    recordId,
    existing,
  );
  updated.updatedBy = values.updatedBy?.trim() || existing.updatedBy;

  commitRoutesStore(
    store.map((assignment, entryIndex) => (entryIndex === index ? updated : assignment)),
  );

  return cloneAssignment(updated);
}

export function deleteRoutesFromStore(recordIds: string[]): void {
  const idSet = new Set(recordIds);
  commitRoutesStore(ensureRoutesStore().filter((assignment) => !idSet.has(assignment.id)));
}
