import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const NUMERIC_OPERATORS = ["eq", "neq", "gte", "lte", "gt", "lt"] as const;
const DATE_OPERATORS = ["eq", "neq", "gte", "lte", "gt", "lt"] as const;

/** Route crew search fields the API types as numbers / booleans. */
export const ROUTE_NUMERIC_FIELDS: ReadonlySet<string> = new Set(["branch.id", "employees.id"]);

export const ROUTE_BOOLEAN_FIELDS: ReadonlySet<string> = new Set(["active"]);

/** Advanced filter fields for route crews — limited to the `/routes/search` allow-list. */
export const ROUTE_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
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
  {
    field: "employees.name",
    label: "Crew members",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter crew name…",
  },
  {
    field: "employees.id",
    label: "Crew member ID",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter employee id…",
  },
  {
    field: "branch.code",
    label: "Branch code",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter branch code…",
  },
  {
    field: "branch.name",
    label: "Branch name",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter branch name…",
  },
  {
    field: "branch.id",
    label: "Branch ID",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter branch id…",
  },
  {
    field: "id",
    label: "Record ID",
    operators: ["eq", "neq"],
    valueType: "text",
    placeholder: "Enter record id…",
  },
  {
    field: "createdBy.name",
    label: "Created by",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter creator name…",
  },
  {
    field: "updatedBy.name",
    label: "Updated by",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter updater name…",
  },
  {
    field: "createdAt",
    label: "Created at",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "updatedAt",
    label: "Updated at",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
];
