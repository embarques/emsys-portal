import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const NUMERIC_OPERATORS = ["eq", "neq", "gte", "lte", "gt", "lt"] as const;
const DATE_OPERATORS = ["eq", "neq", "gte", "lte"] as const;

/**
 * Advanced filter fields for deliveries (delivery.Delivery). `id` is numeric and
 * is coerced to a JSON number in `expandDeliveryFilterNode`; `employeeGroup.id` is
 * a string DTO id and stays text. Date ranges expand to gte/lte pairs.
 */
export const DELIVERY_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "id",
    label: "Delivery ID",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter delivery ID…",
  },
  { field: "name", label: "Delivery", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter delivery name…" },
  {
    field: "container.name",
    label: "Container",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter container name…",
  },
  {
    field: "container.containerNumber",
    label: "Container number",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter container number…",
  },
  {
    field: "employeeGroup.name",
    label: "Employee group",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter employee group…",
  },
  {
    field: "employeeGroup.id",
    label: "Employee group ID",
    operators: ["eq", "neq"],
    valueType: "text",
    placeholder: "Enter employee group ID…",
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
    field: "date",
    label: "Delivery date",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "dateRange",
    label: "Delivery date range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-01-01 to 2026-06-30",
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
    label: "Date updated",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "updatedAtRange",
    label: "Date updated range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-01-01 to 2026-06-30",
  },
];
