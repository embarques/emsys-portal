import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";
import { createTypedFilterExpander } from "@/lib/table/typed-filter-expander";

const TEXT_OPERATORS = ["contains", "startsWith", "eq", "neq"] as const;
const DATE_OPERATORS = ["gte", "lte"] as const;

/** Server filters for POST /invoice-policies/search. */
export const INVOICE_POLICY_BAR_OR_SEARCH_FIELDS = ["title", "body"] as const;

export const INVOICE_POLICY_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  { field: "title", label: "Title", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter title…" },
  { field: "body", label: "Policy text", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter policy text…" },
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
  { field: "sortOrder", label: "Order", operators: ["eq", "neq", "gte", "lte"], valueType: "text", placeholder: "0" },
  { field: "id", label: "ID", operators: ["eq", "neq", "gte", "lte"], valueType: "text", placeholder: "Enter ID…" },
  { field: "createdAt", label: "Created at", operators: [...DATE_OPERATORS], valueType: "text", placeholder: "YYYY-MM-DD" },
  { field: "updatedAt", label: "Updated at", operators: [...DATE_OPERATORS], valueType: "text", placeholder: "YYYY-MM-DD" },
];

export const expandInvoicePolicyFilterNode = createTypedFilterExpander({
  numericFields: ["id", "sortOrder"],
  booleanFields: ["active"],
});
