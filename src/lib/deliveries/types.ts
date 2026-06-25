import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";

export type DeliveryContainerRef = {
  id: number;
  name: string;
  containerNumber: string;
};

export type DeliveryEmployeeRef = {
  id: number;
  name: string;
};

export type Delivery = {
  id: number;
  name: string;
  date: string;
  container: DeliveryContainerRef | null;
  employee: DeliveryEmployeeRef | null;
  helper1: DeliveryEmployeeRef | null;
  helper2: DeliveryEmployeeRef | null;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryBarcodeStatus = {
  id?: number;
  name: string;
};

export type DeliveryBarcodeInvoiceRef = {
  id: string;
  number: string;
};

export type DeliveryBarcode = {
  id: number;
  number: string;
  scanDate: string;
  status: DeliveryBarcodeStatus | null;
  container: DeliveryContainerRef | null;
  delivery: Pick<Delivery, "id" | "name"> | null;
  invoice: DeliveryBarcodeInvoiceRef | null;
  lineItemName: string;
  quantity: number;
};

export type DeliveryInvoiceGroup = {
  key: string;
  invoice: DeliveryBarcodeInvoiceRef | null;
  description: string;
  quantity: number;
  labels: number;
  barcodes: DeliveryBarcode[];
};

export type DeliveryFormValues = {
  id: number;
  name: string;
  date: string;
  containerId: string;
  employeeId: string;
  helper1Id: string;
  helper2Id: string;
};

export type DeliveryFilterState = {
  query: string;
  rows: TableFilterRowState[];
};

export type DeliverySearchFilter = ApiListTextSearch;

export type DeliveryListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: DeliverySearchFilter;
  filterRows?: TableFilterRowState[];
};

export const DEFAULT_DELIVERY_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: "createdAt:desc",
} as const satisfies Pick<DeliveryListParams, "page" | "limit" | "sort">;

export const DELIVERY_SEARCH_FIELDS = [
  { value: "name", label: "Delivery" },
  { value: "container.name", label: "Container" },
  { value: "container.containerNumber", label: "Container number" },
  { value: "employee.name", label: "Driver" },
  { value: "helper1.name", label: "Helper 1" },
  { value: "helper2.name", label: "Helper 2" },
  { value: "id", label: "Delivery ID" },
] as const;

export function createEmptyDeliveryForm(date = new Date()): DeliveryFormValues {
  return {
    id: 0,
    name: "",
    date: date.toISOString().slice(0, 10),
    containerId: "",
    employeeId: "",
    helper1Id: "",
    helper2Id: "",
  };
}

export function createDeliverySearchFilter(value: string): DeliverySearchFilter | undefined {
  return createListTextSearch(value);
}

export function buildDeliveryListParams(input: {
  page: number;
  limit?: number;
  query: string;
  rows: TableFilterRowState[];
  sort?: ApiListSortInput;
}): DeliveryListParams {
  const params: DeliveryListParams = {
    ...DEFAULT_DELIVERY_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_DELIVERY_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_DELIVERY_LIST_PARAMS.sort,
  };

  const search = createDeliverySearchFilter(input.query);
  if (search) {
    params.search = search;
  }

  const completeRows = input.rows.filter((row) => isCompleteFilterRow(row));
  if (completeRows.length > 0) {
    params.filterRows = completeRows;
  }

  return params;
}

export function deliveryToFormValues(delivery: Delivery): DeliveryFormValues {
  return {
    id: delivery.id,
    name: delivery.name,
    date: toFormDate(delivery.date),
    containerId: delivery.container?.id ? String(delivery.container.id) : "",
    employeeId: delivery.employee?.id ? String(delivery.employee.id) : "",
    helper1Id: delivery.helper1?.id ? String(delivery.helper1.id) : "",
    helper2Id: delivery.helper2?.id ? String(delivery.helper2.id) : "",
  };
}

export function toFormDate(value: string): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function toApiDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Delivery date is required.");
  }
  return trimmed.includes("T") ? trimmed : `${trimmed}T00:00:00Z`;
}

export function validateDeliveryFormValues(values: DeliveryFormValues): void {
  if (!values.name.trim()) {
    throw new Error("Delivery name is required.");
  }

  if (!values.date.trim()) {
    throw new Error("Delivery date is required.");
  }

  if (!values.containerId.trim()) {
    throw new Error("Container is required.");
  }

  if (!values.employeeId.trim()) {
    throw new Error("Driver is required.");
  }
}
