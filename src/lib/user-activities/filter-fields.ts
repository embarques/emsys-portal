import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";
import { createTypedFilterExpander } from "@/lib/table/typed-filter-expander";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;

/**
 * Advanced filters for POST /user-activities/search.
 *
 * Known API issue: `timestamp` filters are accepted but currently match no
 * records; they start working once the backend fix ships.
 * `user.id` and the entity `id` are strings on the wire.
 */
export const USER_ACTIVITY_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "severity",
    label: "Severity",
    operators: ["eq", "neq"],
    valueType: "select",
    options: [
      { value: "common", label: "Common" },
      { value: "uncommon", label: "Uncommon" },
      { value: "rare", label: "Rare" },
    ],
  },
  {
    field: "origin",
    label: "Origin",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "e.g. invoices, journals…",
  },
  {
    field: "description",
    label: "Description",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter description…",
  },
  {
    field: "user.name",
    label: "User",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter user name…",
  },
  {
    field: "user.id",
    label: "User ID",
    operators: ["eq", "neq"],
    valueType: "text",
    placeholder: "Enter user ID…",
  },
  {
    field: "id",
    label: "Record ID",
    operators: ["eq", "neq"],
    valueType: "text",
    placeholder: "Enter record ID…",
  },
  {
    field: "timestamp",
    label: "Date",
    operators: ["gte", "lte"],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "timestampRange",
    label: "Date range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-01-01 to 2026-06-30",
  },
];

export const expandUserActivityFilterNode = createTypedFilterExpander({
  rangeFields: { timestampRange: "timestamp" },
});
