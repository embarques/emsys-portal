import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const NUMERIC_OPERATORS = ["eq", "neq", "gte", "lte", "gt", "lt"] as const;
const DATE_OPERATORS = ["eq", "neq", "gte", "lte"] as const;

/**
 * Advanced filter fields for items (invoice-descriptions).
 *
 * `id` and `price` are numeric server-side — their values are coerced to numbers
 * in `expandItemFilterNode` because the backend ignores string numerics.
 */
export const ITEM_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "id",
    label: "Item ID",
    operators: ["eq", "neq", "gte", "lte"],
    valueType: "text",
    placeholder: "Enter item ID…",
  },
  {
    field: "name",
    label: "Description",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter description…",
  },
  {
    field: "price",
    label: "Price",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter amount…",
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
    label: "Date created range",
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
    label: "Date modified range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-01-01 to 2026-06-30",
  },
];
