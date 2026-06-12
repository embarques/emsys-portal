import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";

export type Container = {
  id: number;
  name: string;
  containerNumber: string;
  booking: string;
  sealNumber: string;
  seal: string;
  broker: string;
  company: string;
  cost: number;
  departureDate: string;
  arrivalDate: string;
  barcodeSequence: number;
  deliverySequence: number;
  createdAt: string;
  updatedAt: string;
};

/** @deprecated Use `Container` — kept for gradual migration of dependent modules. */
export type ContainerRecord = Container;

export type ContainerFormValues = {
  id: number;
  name: string;
  containerNumber: string;
  booking: string;
  sealNumber: string;
  broker: string;
  company: string;
  cost: string;
  departureDate: string;
  arrivalDate: string;
};

export type ContainerSearchOperator = "eq" | "neq" | "contains" | "startsWith";

export type ContainerSearchField =
  | "id"
  | "name"
  | "containerNumber"
  | "booking"
  | "sealNumber"
  | "seal"
  | "broker"
  | "company";

export type ContainerSearchFilter = ApiListTextSearch;

export type ContainerFilterState = {
  query: string;
};

export type ContainerListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: ContainerSearchFilter;
};

/** GET /containers?page=1&limit=40&offset=0&sort=name:desc */
export const DEFAULT_CONTAINER_LIST_PARAMS = {
  page: 1,
  limit: 40,
  sort: "name:desc",
} as const satisfies Pick<ContainerListParams, "page" | "limit" | "sort">;

export const CONTAINER_SEARCH_FIELDS: { value: ContainerSearchField; label: string }[] = [
  { value: "name", label: "Container" },
  { value: "containerNumber", label: "Container number" },
  { value: "booking", label: "Booking number" },
  { value: "sealNumber", label: "Seal number" },
  { value: "broker", label: "Broker" },
  { value: "company", label: "Transport company" },
  { value: "id", label: "Container ID" },
];

export const CONTAINER_SEARCH_OPERATORS: { value: ContainerSearchOperator; label: string }[] = [
  { value: "startsWith", label: "Starts with" },
  { value: "contains", label: "Contains" },
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
];

export function createEmptyContainerForm(): ContainerFormValues {
  return {
    id: 0,
    name: "",
    containerNumber: "",
    booking: "",
    sealNumber: "",
    broker: "",
    company: "",
    cost: "",
    departureDate: "",
    arrivalDate: "",
  };
}

export function createContainerSearchFilter(value: string): ContainerSearchFilter | undefined {
  return createListTextSearch(value);
}

export function containerToFormValues(container: Container): ContainerFormValues {
  return {
    id: container.id,
    name: container.name,
    containerNumber: container.containerNumber,
    booking: container.booking,
    sealNumber: container.sealNumber,
    broker: container.broker,
    company: container.company,
    cost: container.cost > 0 ? container.cost.toFixed(2) : "",
    departureDate: toFormDate(container.departureDate),
    arrivalDate: toFormDate(container.arrivalDate),
  };
}

export function suggestNextContainerName(existing: Container[], date = new Date()): string {
  const yearSuffix = String(date.getFullYear()).slice(-2);
  const sameYearCodes = existing
    .map((entry) => entry.name)
    .filter((code) => code.endsWith(`-${yearSuffix}`))
    .map((code) => Number.parseInt(code.split("-")[0] ?? "0", 10))
    .filter((value) => Number.isFinite(value));

  const nextSequence = (sameYearCodes.length > 0 ? Math.max(...sameYearCodes) : 0) + 1;
  return `${String(nextSequence).padStart(2, "0")}-${yearSuffix}`;
}

export function toFormDate(value: string): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function toApiDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Date is required.");
  }
  return trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00Z`;
}

export function validateContainerFormValues(values: ContainerFormValues): void {
  if (!values.name.trim()) {
    throw new Error("Container name is required (e.g. 01-26).");
  }

  if (!values.booking.trim()) {
    throw new Error("Booking number is required.");
  }

  if (values.cost.trim()) {
    const cost = Number(values.cost);
    if (!Number.isFinite(cost) || cost < 0) {
      throw new Error("Cost must be a valid number greater than or equal to 0.");
    }
  }
}
