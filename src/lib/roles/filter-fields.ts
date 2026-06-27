import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const DATE_OPERATORS = ["eq", "neq", "gte", "lte"] as const;

/**
 * Advanced filter fields for roles.
 *
 * `id` is numeric server-side — its value is coerced to a number in
 * `expandRoleFilterNode` because the strict API rejects stringified numbers.
 *
 * `active` and `permissions.*` are intentionally omitted: probing
 * POST /roles/search shows the backend rejects those fields with a 400
 * ("search query validation failed").
 */
export const ROLE_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "id",
    label: "Role ID",
    operators: ["eq", "neq", "gte", "lte"],
    valueType: "text",
    placeholder: "Enter role ID…",
  },
  {
    field: "name",
    label: "Role name",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter role name…",
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
    label: "Date created",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "createdAtRange",
    label: "Created date range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-01-01 to 2026-06-30",
  },
  {
    field: "updatedAt",
    label: "Date modified",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "updatedAtRange",
    label: "Modified date range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-01-01 to 2026-06-30",
  },
];
