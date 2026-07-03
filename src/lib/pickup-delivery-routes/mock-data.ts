import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { deriveRouteType } from "@/lib/pickup-delivery-routes/types";
import {
  clearBrowserStore,
  readBrowserStore,
  writeBrowserStore,
} from "@/lib/local-dev/browser-store";
import { getRouteByRecordId } from "@/lib/route-manager/mock-data";

const LOCAL_ACTIVE_ROUTES_STORAGE_KEY = "emsys-local-active-routes";

/** @deprecated Empty — local dev store starts blank and persists in localStorage. */
export const MOCK_ACTIVE_ROUTES: ActiveRoute[] = [];

function cloneActiveRoute(record: ActiveRoute): ActiveRoute {
  return {
    ...record,
    name: String(record.name ?? ""),
    dayOfWeek: Array.isArray(record.dayOfWeek) ? [...record.dayOfWeek] : [],
    branch: record.branch ? { ...record.branch } : null,
    active: record.active !== false,
    container: record.container ? { ...record.container } : null,
    route: record.route ? { ...record.route } : { id: record.id, name: record.id },
    employees: Array.isArray(record.employees)
      ? record.employees.map((employee) => ({ ...employee }))
      : [],
  };
}

let activeRoutesStore: ActiveRoute[] | null = null;

function ensureActiveRoutesStore(): ActiveRoute[] {
  if (activeRoutesStore === null) {
    activeRoutesStore = readBrowserStore<ActiveRoute>(LOCAL_ACTIVE_ROUTES_STORAGE_KEY)
      .filter((record): record is ActiveRoute => Boolean(record && typeof record === "object" && record.id))
      .map(cloneActiveRoute);
  }
  return activeRoutesStore;
}

function commitActiveRoutesStore(next: ActiveRoute[]): void {
  activeRoutesStore = next.map(cloneActiveRoute);
  writeBrowserStore(LOCAL_ACTIVE_ROUTES_STORAGE_KEY, activeRoutesStore);
}

export function cloneActiveRoutes(): ActiveRoute[] {
  return ensureActiveRoutesStore().map(cloneActiveRoute);
}

export function setActiveRoutesStore(records: ActiveRoute[]): void {
  commitActiveRoutesStore(records);
}

export function resetActiveRoutesStore(): void {
  activeRoutesStore = [];
  clearBrowserStore(LOCAL_ACTIVE_ROUTES_STORAGE_KEY);
}

export function getActiveRouteById(id: string): ActiveRoute | undefined {
  return ensureActiveRoutesStore().find((record) => record.id === id);
}

export function findActiveRouteByLookup(params: {
  routeType: "pickup" | "delivery";
  date: string;
  containerId?: number;
}): ActiveRoute | undefined {
  const isoDate = params.date.trim().slice(0, 10);
  return ensureActiveRoutesStore().find((record) => {
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
  });
}

export function upsertActiveRouteInStore(record: ActiveRoute): ActiveRoute {
  const store = ensureActiveRoutesStore();
  const index = store.findIndex((entry) => entry.id === record.id);
  if (index >= 0) {
    commitActiveRoutesStore(
      store.map((entry, entryIndex) => (entryIndex === index ? record : entry)),
    );
  } else {
    commitActiveRoutesStore([record, ...store]);
  }
  return cloneActiveRoute(record);
}

export function deleteActiveRoutesFromStore(recordIds: string[]): void {
  const idSet = new Set(recordIds.map((id) => id.trim()).filter(Boolean));
  if (idSet.size === 0) return;
  commitActiveRoutesStore(ensureActiveRoutesStore().filter((entry) => !idSet.has(entry.id)));
}

export function replaceActiveRouteInStore(recordId: string, record: ActiveRoute): ActiveRoute {
  const store = ensureActiveRoutesStore();
  const index = store.findIndex((entry) => entry.id === recordId);
  if (index < 0) {
    throw new Error("Active route not found.");
  }
  commitActiveRoutesStore(
    store.map((entry, entryIndex) => (entryIndex === index ? record : entry)),
  );
  return cloneActiveRoute(record);
}

export function buildMockActiveRouteName(
  scheduleLabel: string,
  routeRecordId: string,
  container: ActiveRoute["container"],
  providedName?: string,
): string {
  const route = getRouteByRecordId(routeRecordId);
  const routeType = deriveRouteType(container);

  if (routeType === "delivery" && container) {
    const year = scheduleLabel.trim().slice(0, 4);
    const suffix = /^\d{4}$/.test(year) ? `-${year}` : "";
    return `01-${container.name}${suffix}`;
  }

  const trimmedName = providedName?.trim();
  if (trimmedName) return trimmedName;

  const employeePart = route?.employees.map((employee) => employee.name).join("-") ?? "crew";
  const vehiclePart = route?.vehicle.name ?? "vehicle";
  return `${scheduleLabel}-${employeePart}-${vehiclePart}`;
}
