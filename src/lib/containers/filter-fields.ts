import { CONTAINER_SEARCH_FIELDS } from "@/lib/containers/types";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_FILTER_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;

export const CONTAINER_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = CONTAINER_SEARCH_FIELDS.map(
  (entry) => ({
    field: entry.value,
    label: entry.label,
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text" as const,
    placeholder: `Enter ${entry.label.toLowerCase()}…`,
  }),
);
