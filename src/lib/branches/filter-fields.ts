import { BRANCH_SEARCH_FIELDS } from "@/lib/branches/types";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";
import { createTypedFilterExpander } from "@/lib/table/typed-filter-expander";

const TEXT_FILTER_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const DATE_FILTER_OPERATORS = ["eq", "neq", "gte", "lte"] as const;

export const BRANCH_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  ...BRANCH_SEARCH_FIELDS.map((entry) => ({
    field: entry.value,
    label: entry.label,
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text" as const,
    placeholder: `Enter ${entry.label.toLowerCase()}…`,
  })),
  { field: "id", label: "Branch ID", operators: ["eq", "neq", "gte", "lte"], valueType: "text", placeholder: "Enter branch ID…" },
  { field: "createdAt", label: "Created at", operators: [...DATE_FILTER_OPERATORS], valueType: "text", placeholder: "YYYY-MM-DD" },
  { field: "updatedAt", label: "Updated at", operators: [...DATE_FILTER_OPERATORS], valueType: "text", placeholder: "YYYY-MM-DD" },
  { field: "createdBy.name", label: "Created by", operators: [...TEXT_FILTER_OPERATORS], valueType: "text", placeholder: "Enter name…" },
  { field: "updatedBy.name", label: "Updated by", operators: [...TEXT_FILTER_OPERATORS], valueType: "text", placeholder: "Enter name…" },
];

export const expandBranchFilterNode = createTypedFilterExpander({ numericFields: ["id"] });
