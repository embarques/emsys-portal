import { USER_ROLE_OPTIONS } from "@/lib/users/types";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const NUMERIC_OPERATORS = ["eq", "neq", "gte", "lte", "gt", "lt"] as const;
const DATE_OPERATORS = ["eq", "neq", "gte", "lte"] as const;

/**
 * Advanced filter fields for users. `id`, `branch.id`, `role.id`, and `accessCode`
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
  { field: "userName", label: "Username", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter username…" },
  { field: "fullName", label: "Full name", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter full name…" },
  { field: "email", label: "Email", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter email…" },
  { field: "uid", label: "UID", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter UID…" },
  { field: "type", label: "Type", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter type…" },
  { field: "role.name", label: "Role name", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter role name…" },
  { field: "branch.name", label: "Branch name", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter branch name…" },
  { field: "branch.code", label: "Branch code", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter branch code…" },
  {
    field: "accessCode",
    label: "Access code",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter access code…",
  },
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
    label: "Role",
    operators: ["eq", "neq"],
    valueType: "select",
    options: USER_ROLE_OPTIONS.map((role) => ({ value: String(role.id), label: role.label })),
  },
  {
    field: "createdAt",
    label: "Date created",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
];
