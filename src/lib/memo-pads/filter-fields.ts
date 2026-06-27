import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_FILTER_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;

export const MEMO_PAD_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "name",
    label: "Name",
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text",
    placeholder: "Enter name…",
  },
  {
    field: "content",
    label: "Content",
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text",
    placeholder: "Enter content…",
  },
  {
    field: "createdBy.name",
    label: "Created by",
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text",
    placeholder: "Enter creator…",
  },
  {
    field: "updatedBy.name",
    label: "Updated by",
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text",
    placeholder: "Enter editor…",
  },
];
