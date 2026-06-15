import { USER_GET_SEARCH_CAPABILITIES, USER_ROLE_OPTIONS } from "@/lib/users/types";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_FIELDS = new Set(["userName", "fullName", "email", "uid", "type", "role.name"]);

export const USER_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  ...USER_GET_SEARCH_CAPABILITIES.filter((entry) => TEXT_FIELDS.has(entry.field)).map((entry) => ({
    field: entry.field,
    label: entry.label,
    operators: entry.operators,
    valueType: "text" as const,
    placeholder: `Enter ${entry.label.toLowerCase()}…`,
  })),
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
];
