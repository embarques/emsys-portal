import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const NUMERIC_OPERATORS = ["eq", "neq", "gte", "lte", "gt", "lt"] as const;
const DATE_OPERATORS = ["eq", "neq", "gte", "lte"] as const;

/**
 * Advanced filter fields for barcodes.
 *
 * Probed 2026-07-09: `POST /barcodes/search` accepts only the fields below.
 * Embedded refs (status, container, route, delivery) are returned on GET but are
 * not searchable server-side yet.
 */
export const BARCODE_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "id",
    label: "Barcode ID",
    operators: ["eq", "neq", "gte", "lte", "contains", "startsWith"],
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
    field: "scanDate",
    label: "Scan date",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "createdAt",
    label: "Date created",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "updatedAt",
    label: "Date modified",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "createdBy.name",
    label: "Created by",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter creator…",
  },
  {
    field: "updatedBy.name",
    label: "Updated by",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter editor…",
  },
  {
    field: "createdBy.id",
    label: "Creator ID",
    operators: [...NUMERIC_OPERATORS, "contains", "startsWith"],
    valueType: "text",
    placeholder: "Enter creator ID…",
  },
  {
    field: "updatedBy.id",
    label: "Editor ID",
    operators: [...NUMERIC_OPERATORS, "contains", "startsWith"],
    valueType: "text",
    placeholder: "Enter editor ID…",
  },
];
