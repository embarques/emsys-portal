import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const DATE_OPERATORS = ["eq", "neq", "gte", "lte"] as const;

/**
 * Advanced filter fields for users. `id`, `branch.id`, and `role.id`
 * are coerced to numbers (and `active` to boolean) in `expandUserFilterNode`
 * because the strict API requires JSON numbers/booleans for those fields.
 */
export const USER_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "id",
    label: "User ID",
    operators: ["eq", "neq", "gte", "lte"],
    valueType: "text",
    placeholder: "Enter user ID…",
  },
  { field: "name", label: "Name", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter name…" },
  { field: "email", label: "Email", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter email…" },
  { field: "uid", label: "UID", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter UID…" },
  { field: "role.name", label: "Role", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter role name…" },
  { field: "branch.name", label: "Branch name", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter branch name…" },
  {
    field: "active",
    label: "Active",
    operators: ["eq", "neq"],
    valueType: "select",
    options: [
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
  },
  {
    field: "branch.id",
    label: "Branch",
    operators: ["eq", "neq"],
    valueType: "select",
    optionsSource: "branches",
  },
  {
    field: "role.id",
    label: "Role ID",
    operators: ["eq", "neq"],
    valueType: "text",
    placeholder: "Enter role ID…",
  },
  {
    field: "createdAt",
    label: "Created at",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
];
