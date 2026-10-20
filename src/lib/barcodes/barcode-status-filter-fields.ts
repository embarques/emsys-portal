import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";
import { createTypedFilterExpander } from "@/lib/table/typed-filter-expander";

/**
 * Server filters for POST /barcode-statuses/search. `previousStatus` /
 * `previousStatus.name` are rejected by the API allow-list.
 */
export const BARCODE_STATUS_BAR_OR_SEARCH_FIELDS = ["name"] as const;

export const BARCODE_STATUS_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  { field: "name", label: "Name", operators: ["contains", "startsWith", "eq", "neq"], valueType: "text", placeholder: "Enter status name…" },
  { field: "id", label: "ID", operators: ["eq", "neq", "gte", "lte"], valueType: "text", placeholder: "Enter ID…" },
];

export const expandBarcodeStatusFilterNode = createTypedFilterExpander({ numericFields: ["id"] });
