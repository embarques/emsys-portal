import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createMockObjectId } from "@/lib/vehicles/types";
import type { ApiListSortInput } from "@/lib/api/list-query";
import type { ApiListTextSearch } from "@/lib/api/search-query";

export type RouteVehicleRef = {
  id: string;
  name: string;
};

export type RouteEmployeeGroupRef = {
  id: string;
  name: string;
  branch?: string;
};

export type RouteContainerRef = {
  id: number;
  name: string;
};

export type RouteType = "pickup" | "delivery";

export type Route = {
  id: string;
  routeId: string;
  name: string;
  date: string;
  container: RouteContainerRef | null;
  tripNumber: number;
  vehicle: RouteVehicleRef;
  employeeGroup: RouteEmployeeGroupRef;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type RouteFormValues = {
  id: string;
  routeId: string;
  name: string;
  date: string;
  routeType: RouteType;
  container: RouteContainerRef | null;
  vehicle: RouteVehicleRef;
  employeeGroup: RouteEmployeeGroupRef;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type RouteFilterState = {
  query: string;
};

export type RouteListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: ApiListTextSearch;
};

export type RouteSearchFilter = ApiListTextSearch;

export const DEFAULT_ROUTE_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: "date:desc",
} as const satisfies RouteListParams;

/** Fields the bar search fans out across with an OR group. */
export const ROUTE_BAR_OR_SEARCH_FIELDS = [
  "name",
  "routeId",
  "vehicle.name",
  "employeeGroup.name",
] as const;

export function createEmptyVehicleRef(): RouteVehicleRef {
  return { id: "", name: "" };
}

export function createEmptyEmployeeGroupRef(): RouteEmployeeGroupRef {
  return { id: "", name: "" };
}

export function createEmptyContainerRef(): RouteContainerRef {
  return { id: 0, name: "" };
}

export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toRouteDateIso(dateInput: string): string {
  const trimmed = dateInput.trim();
  if (!trimmed) return "";
  if (trimmed.includes("T")) return trimmed;
  return `${trimmed}T00:00:00Z`;
}

export function toRouteDateInput(iso: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function generateRouteNumber(): string {
  const random = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `ras-${Date.now().toString(36)}-${random}`;
}

export function createEmptyRouteForm(createdBy = DEFAULT_CREATED_BY): RouteFormValues {
  return {
    id: "",
    routeId: generateRouteNumber(),
    name: "",
    date: todayDateInputValue(),
    routeType: "pickup",
    container: null,
    vehicle: createEmptyVehicleRef(),
    employeeGroup: createEmptyEmployeeGroupRef(),
    createdBy,
    createdAt: "",
    updatedAt: "",
  };
}

export function routeToFormValues(assignment: Route): RouteFormValues {
  return {
    id: assignment.id,
    routeId: assignment.routeId,
    name: assignment.name,
    date: toRouteDateInput(assignment.date),
    routeType: assignment.container ? "delivery" : "pickup",
    container: assignment.container ? { ...assignment.container } : null,
    vehicle: { ...assignment.vehicle },
    employeeGroup: { ...assignment.employeeGroup },
    createdBy: assignment.createdBy,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };
}

export function formValuesToRoute(
  values: RouteFormValues,
  createdAt?: string,
  updatedAt?: string,
  id?: string,
): Route {
  if (!values.employeeGroup.id.trim()) {
    throw new Error("An employee group is required.");
  }

  const now = new Date().toISOString();

  return {
    id: id ?? (values.id.trim() || createMockObjectId()),
    routeId: values.routeId.trim(),
    name: values.name.trim(),
    date: toRouteDateIso(values.date),
    container:
      values.routeType === "delivery" && values.container
        ? { id: values.container.id, name: values.container.name.trim() }
        : null,
    tripNumber: 0,
    vehicle: {
      id: values.vehicle.id.trim(),
      name: values.vehicle.name.trim(),
    },
    employeeGroup: {
      id: values.employeeGroup.id.trim(),
      name: values.employeeGroup.name.trim(),
    },
    createdAt: createdAt ?? (values.createdAt || now),
    createdBy: values.createdBy.trim() || DEFAULT_CREATED_BY,
    updatedAt: updatedAt ?? (values.updatedAt || now),
  };
}

export function resolveRouteVehicleForForm(
  source: RouteVehicleRef,
  vehicles: Array<{ id: string; name: string }>,
): RouteVehicleRef {
  if (!source.id.trim() && !source.name.trim()) {
    return createEmptyVehicleRef();
  }

  const match = vehicles.find(
    (vehicle) =>
      (source.id && vehicle.id === source.id) ||
      (source.name && vehicle.name === source.name),
  );

  return match ? { id: match.id, name: match.name } : { ...source };
}

export function resolveRouteEmployeeGroupForForm(
  source: RouteEmployeeGroupRef,
  employeeGroups: Array<{ id: string; employeeGroupId: string; name: string }>,
): RouteEmployeeGroupRef {
  if (!source.id.trim() && !source.name.trim()) {
    return createEmptyEmployeeGroupRef();
  }

  const match = employeeGroups.find(
    (group) =>
      (source.id && (group.id === source.id || group.employeeGroupId === source.id)) ||
      (source.name && group.name === source.name),
  );

  return match ? { id: match.id, name: match.name } : { ...source };
}

export function copyRouteFormValues(
  source: Route,
  current: Pick<RouteFormValues, "createdBy" | "date">,
  options: {
    vehicles: Array<{ id: string; name: string }>;
    employeeGroups: Array<{ id: string; employeeGroupId: string; name: string }>;
  },
): RouteFormValues {
  return {
    id: "",
    routeId: generateRouteNumber(),
    name: "",
    date: current.date.trim() || todayDateInputValue(),
    routeType: source.container ? "delivery" : "pickup",
    container: source.container ? { ...source.container } : null,
    vehicle: resolveRouteVehicleForForm(source.vehicle, options.vehicles),
    employeeGroup: resolveRouteEmployeeGroupForForm(source.employeeGroup, options.employeeGroups),
    createdBy: current.createdBy,
    createdAt: "",
    updatedAt: "",
  };
}
