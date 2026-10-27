import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["contains", "startsWith", "eq", "neq"] as const;

/** Server filters for POST /deliveries/assigned-barcodes/search. */
export const ASSIGNED_DELIVERY_BAR_OR_SEARCH_FIELDS = [
  "number",
  "invoice.number",
  "name",
  "receiver.name",
  "receiver.address.city",
  "container.name",
] as const;

export const ASSIGNED_DELIVERY_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  { field: "number", label: "Barcode", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter barcode…" },
  { field: "invoice.number", label: "Invoice number", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter invoice…" },
  { field: "receiver.name", label: "Receiver name", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter receiver…" },
  { field: "receiver.address.state", label: "Province", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter province…" },
  { field: "receiver.address.city", label: "City", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter city…" },
  { field: "container.name", label: "Container", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter container…" },
];
