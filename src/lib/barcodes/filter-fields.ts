import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const NUMERIC_OPERATORS = ["eq", "neq", "gte", "lte", "gt", "lt"] as const;
const DATE_OPERATORS = ["eq", "neq", "gte", "lte"] as const;

export const BARCODE_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "id",
    label: "Barcode ID",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter barcode ID…",
  },
  {
    field: "number",
    label: "Barcode",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter barcode number…",
  },
  {
    field: "status.name",
    label: "Status",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter status…",
  },
  {
    field: "container.name",
    label: "Container",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter container…",
  },
  {
    field: "scanDate",
    label: "Scan date",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
];
