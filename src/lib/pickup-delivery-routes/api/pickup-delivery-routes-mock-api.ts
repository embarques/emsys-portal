import type { PaginatedResult } from "@/lib/api/types";
import {
  activeRouteMatchesQuery,
  activeRouteMatchesSearch,
} from "@/lib/pickup-delivery-routes/display";
import type { ActiveRouteFormValues, ActiveRouteListParams, ActiveRouteLookupParams } from "@/lib/pickup-delivery-routes/types";
import {
  assertActiveRouteFormValues,
  deriveRouteType,
  DEFAULT_ACTIVE_ROUTE_LIST_PARAMS,
  type ActiveRoute,
} from "@/lib/pickup-delivery-routes/types";
import {
  buildMockActiveRouteName,
  cloneActiveRoutes,
  findActiveRouteByLookup,
  deleteActiveRoutesFromStore,
  getActiveRouteById,
  replaceActiveRouteInStore,
  resetActiveRoutesStore,
  upsertActiveRouteInStore,
} from "@/lib/pickup-delivery-routes/mock-data";
import { getRouteByRecordId } from "@/lib/route-manager/mock-data";
import { createMockObjectId } from "@/lib/vehicles/types";

const MOCK_LATENCY_MS = 120;

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
}

function buildRouteRef(routeRecordId: string): ActiveRoute["route"] {
  const route = getRouteByRecordId(routeRecordId);
  if (!route) {
    throw new Error("Route not found.");
  }

  return {
    id: route.id,
    name: route.name,
    routeId: route.routeId,
  };
}

function assertCrewRoles(values: ActiveRouteFormValues): void {
  const route = getRouteByRecordId(values.routeRecordId.trim());
  if (!route) return;

  const crewIds = new Set(route.employees.map((employee) => employee.id));
  if (values.driver && !crewIds.has(values.driver.id)) {
    throw new Error("Driver must be a crew member on the selected route.");
  }
  if (values.appraiser && !crewIds.has(values.appraiser.id)) {
    throw new Error("Appraiser must be a crew member on the selected route.");
  }
}

function formValuesToActiveRoute(
  values: ActiveRouteFormValues,
  existing?: ActiveRoute,
): ActiveRoute {
  assertActiveRouteFormValues(values);
  assertCrewRoles(values);

  const now = new Date().toISOString();
  const date = values.date.trim().slice(0, 10);
  const container =
    values.routeType === "delivery" && values.container && values.container.id > 0
      ? { id: values.container.id, name: values.container.name.trim() }
      : null;
  const route = buildRouteRef(values.routeRecordId.trim());

  return {
    id: existing?.id ?? createMockObjectId(),
    name: buildMockActiveRouteName(date, values.routeRecordId, container),
    routeType: deriveRouteType(container),
    container,
    date,
    route,
    driver: values.driver ? { ...values.driver } : null,
    appraiser: values.appraiser ? { ...values.appraiser } : null,
    createdAt: existing?.createdAt ?? now,
    createdBy: existing?.createdBy ?? "Local User",
    updatedAt: now,
    updatedBy: "Local User",
  };
}

function paginateActiveRoutes(
  items: ActiveRoute[],
  params: ActiveRouteListParams,
): PaginatedResult<ActiveRoute> {
  const page = params.page ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.page;
  const limit = params.limit ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.limit;
  const start = (page - 1) * limit;
  const slice = items.slice(start, start + limit);

  return {
    items: slice,
    page,
    resultsPerPage: limit,
    total: items.length,
  };
}

function filterActiveRoutes(params: ActiveRouteListParams): ActiveRoute[] {
  let items = cloneActiveRoutes();

  if (params.routeType) {
    items = items.filter((record) => record.routeType === params.routeType);
  }

  const search = params.search;
  if (search?.value.trim()) {
    const searchField = search.field;
    if (searchField) {
      items = items.filter((record) =>
        activeRouteMatchesSearch(record, {
          field: searchField,
          operator: search.operator ?? "contains",
          value: search.value,
        }),
      );
    } else {
      items = items.filter((record) => activeRouteMatchesQuery(record, search.value));
    }
  }

  const sort = params.sort ?? DEFAULT_ACTIVE_ROUTE_LIST_PARAMS.sort;
  const sortSpec =
    typeof sort === "string"
      ? { field: sort.split(":")[0] ?? "date", direction: sort.split(":")[1] ?? "desc" }
      : Array.isArray(sort)
        ? sort[0]
        : sort;
  const field = sortSpec?.field ?? "date";
  const direction = sortSpec?.direction ?? "desc";
  const multiplier = direction === "desc" ? -1 : 1;

  items.sort((left, right) => {
    const compare = (() => {
      switch (field) {
        case "name":
          return left.name.localeCompare(right.name);
        case "date":
          return left.date.localeCompare(right.date);
        case "route.name":
          return left.route.name.localeCompare(right.route.name);
        case "createdAt":
          return left.createdAt.localeCompare(right.createdAt);
        default:
          return left.date.localeCompare(right.date);
      }
    })();
    return compare * multiplier;
  });

  return items;
}

export async function fetchActiveRoutes(
  params: ActiveRouteListParams = {},
): Promise<PaginatedResult<ActiveRoute>> {
  await delay();
  return paginateActiveRoutes(filterActiveRoutes(params), params);
}

export async function fetchActiveRoute(
  params: ActiveRouteLookupParams,
): Promise<ActiveRoute | null> {
  await delay();
  const date = params.date.trim().slice(0, 10);
  if (!date) return null;
  if (params.routeType === "delivery" && !params.containerId) return null;

  const record = findActiveRouteByLookup({ ...params, date });
  return record ? { ...record } : null;
}

export async function fetchActiveRouteById(recordId: string): Promise<ActiveRoute> {
  await delay();
  const record = getActiveRouteById(recordId);
  if (!record) {
    throw new Error("Active route not found.");
  }
  return { ...record };
}

export async function createActiveRoute(values: ActiveRouteFormValues): Promise<ActiveRoute> {
  await delay();
  return upsertActiveRouteInStore(formValuesToActiveRoute(values));
}

export async function updateActiveRoute(
  recordId: string,
  values: ActiveRouteFormValues,
): Promise<ActiveRoute> {
  await delay();
  const existing = getActiveRouteById(recordId);
  if (!existing) {
    throw new Error("Active route not found.");
  }
  return replaceActiveRouteInStore(recordId, formValuesToActiveRoute(values, existing));
}

export async function deleteActiveRoute(recordId: string): Promise<void> {
  await delay();
  const id = recordId.trim();
  if (!id || !getActiveRouteById(id)) {
    throw new Error("Active route not found.");
  }
  deleteActiveRoutesFromStore([id]);
}

export async function deleteActiveRoutes(recordIds: string[]): Promise<void> {
  await delay();
  deleteActiveRoutesFromStore(recordIds);
}

export async function upsertActiveRoute(
  values: ActiveRouteFormValues,
  existingId?: string | null,
): Promise<ActiveRoute> {
  const recordId = existingId?.trim();
  if (recordId) {
    return updateActiveRoute(recordId, values);
  }

  const existing = findActiveRouteByLookup({
    routeType: values.routeType,
    date: values.date.trim().slice(0, 10),
    ...(values.routeType === "delivery" && values.container
      ? { containerId: values.container.id }
      : {}),
  });

  if (existing) {
    return updateActiveRoute(existing.id, values);
  }

  return createActiveRoute(values);
}

/** Reset local store to empty (tests/dev only). */
export function resetActiveRoutesMockStore(): void {
  resetActiveRoutesStore();
}
