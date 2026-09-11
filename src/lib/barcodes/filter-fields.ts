import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const NUMERIC_OPERATORS = ["eq", "neq", "gte", "lte", "gt", "lt"] as const;
const DATE_OPERATORS = ["eq", "neq", "gte", "lte"] as const;

/**
 * Advanced filter fields for barcodes.
 *
 * Prefer merchandise fields (invoice, description, container, status, route).
 * Nested refs may require backend search support; scalar audit fields remain as
 * fallbacks when those nested filters are rejected.
 */
export const BARCODE_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "number",
    label: "Barcode",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter barcode number…",
  },
  {
    field: "invoice.number",
    label: "Invoice",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter invoice number…",
  },
  {
    field: "description",
    label: "Description",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter description…",
  },
  {
    field: "container.name",
    label: "Container",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter container…",
  },
  {
    field: "status.name",
    label: "Status",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter status…",
  },
  {
    field: "route.name",
    label: "Route",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter route…",
  },
  {
    field: "id",
    label: "#",
    operators: ["eq", "neq", "gte", "lte", "contains", "startsWith"],
    valueType: "text",
    placeholder: "Enter barcode ID…",
  },
  {
    field: "scanDate",
    label: "Last scan",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
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
