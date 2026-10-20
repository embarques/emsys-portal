import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";
import { createTypedFilterExpander } from "@/lib/table/typed-filter-expander";

/**
 * Server filters shared by the id/name/active lookup catalogs
 * (POST /employee-titles/search, /employee-departments/search).
 */
export const NAMED_CATALOG_BAR_OR_SEARCH_FIELDS = ["name"] as const;

export const NAMED_CATALOG_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  { field: "name", label: "Name", operators: ["contains", "startsWith", "eq", "neq"], valueType: "text", placeholder: "Enter name…" },
  {
    field: "active",
    label: "Status",
    operators: ["eq", "neq"],
    valueType: "select",
    options: [
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
  },
  { field: "id", label: "ID", operators: ["eq", "neq", "gte", "lte"], valueType: "text", placeholder: "Enter ID…" },
  { field: "createdAt", label: "Created at", operators: ["gte", "lte"], valueType: "text", placeholder: "YYYY-MM-DD" },
  { field: "updatedAt", label: "Updated at", operators: ["gte", "lte"], valueType: "text", placeholder: "YYYY-MM-DD" },
];

export const expandNamedCatalogFilterNode = createTypedFilterExpander({
  numericFields: ["id"],
  booleanFields: ["active"],
});
