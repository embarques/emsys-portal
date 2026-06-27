import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const NUMERIC_OPERATORS = ["eq", "neq", "gte", "lte", "gt", "lt"] as const;
const DATE_OPERATORS = ["eq", "neq", "gte", "lte"] as const;

/**
 * Advanced filter fields for containers.
 *
 * `id` and `cost` are numeric server-side — their values are coerced to numbers
 * in `expandContainerFilterNode` because the backend ignores string numerics.
 */
export const CONTAINER_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "id",
    label: "Container ID",
    operators: ["eq", "neq", "gte", "lte"],
    valueType: "text",
    placeholder: "Enter container ID…",
  },
  {
    field: "name",
    label: "Container",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter container…",
  },
  {
    field: "containerNumber",
    label: "Container number",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter container number…",
  },
  {
    field: "booking",
    label: "Booking number",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter booking number…",
  },
  {
    field: "sealNumber",
    label: "Seal number",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter seal number…",
  },
  {
    field: "seal",
    label: "Seal",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter seal…",
  },
  {
    field: "broker",
    label: "Broker",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter broker…",
  },
  {
    field: "company",
    label: "Transport company",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter transport company…",
  },
  {
    field: "cost",
    label: "Cost",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter amount…",
  },
  {
    field: "departureDate",
    label: "Departure date",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "departureDateRange",
    label: "Departure date range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-01-01 to 2026-06-30",
  },
  {
    field: "arrivalDate",
    label: "Arrival date",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "arrivalDateRange",
    label: "Arrival date range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-01-01 to 2026-06-30",
  },
];
