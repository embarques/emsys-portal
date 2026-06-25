import { DELIVERY_SEARCH_FIELDS } from "@/lib/deliveries/types";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_FILTER_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;

export const DELIVERY_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = DELIVERY_SEARCH_FIELDS.map(
  (entry) => ({
    field: entry.value,
    label: entry.label,
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text" as const,
    placeholder: `Enter ${entry.label.toLowerCase()}...`,
  }),
);
