import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";
import { createTypedFilterExpander } from "@/lib/table/typed-filter-expander";

const TEXT_OPERATORS = ["contains", "startsWith", "eq", "neq"] as const;

/** Server filters for POST /legacy-routes/search. */
export const LEGACY_ROUTE_BAR_OR_SEARCH_FIELDS = ["name", "content"] as const;

export const LEGACY_ROUTE_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  { field: "name", label: "Route name", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter route name…" },
  { field: "content", label: "Cities / ZIP codes", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter a city or ZIP…" },
  { field: "id", label: "ID", operators: ["eq", "neq", "gte", "lte"], valueType: "text", placeholder: "Enter ID…" },
];

export const expandLegacyRouteFilterNode = createTypedFilterExpander({
  numericFields: ["id"],
});
