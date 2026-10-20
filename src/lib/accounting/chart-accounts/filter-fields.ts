import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";
import { createTypedFilterExpander } from "@/lib/table/typed-filter-expander";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const DATE_OPERATORS = ["gte", "lte"] as const;

/**
 * Advanced filters for POST /chart-accounts/search.
 * `createdBy.name` is rejected by the API allow-list, so it is not offered.
 */
export const CHART_ACCOUNT_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "type",
    label: "Type",
    operators: ["eq", "neq"],
    valueType: "select",
    options: [
      { value: "ASSET", label: "Asset" },
      { value: "BANK", label: "Bank" },
      { value: "EXPENSE", label: "Expense" },
      { value: "LOAN", label: "Loan" },
      { value: "REVENUE", label: "Revenue" },
    ],
  },
  {
    field: "displayName",
    label: "Account",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter account name…",
  },
  {
    field: "name",
    label: "Internal name",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter internal name…",
  },
  {
    field: "id",
    label: "Account #",
    operators: ["eq", "neq", "gte", "lte"],
    valueType: "text",
    placeholder: "Enter account number…",
  },
  {
    field: "branch.code",
    label: "Branch code",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "e.g. NY",
  },
  {
    field: "branch.name",
    label: "Branch name",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter branch name…",
  },
  {
    field: "createdAt",
    label: "Created at",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "createdAtRange",
    label: "Created at range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-01-01 to 2026-06-30",
  },
  {
    field: "updatedAt",
    label: "Updated at",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "updatedAtRange",
    label: "Updated at range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-01-01 to 2026-06-30",
  },
];

export const expandChartAccountFilterNode = createTypedFilterExpander({
  numericFields: ["id"],
  rangeFields: { createdAtRange: "createdAt", updatedAtRange: "updatedAt" },
});
