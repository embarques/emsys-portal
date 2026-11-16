import { COMPLAINT_SEVERITIES, COMPLAINT_STATUSES } from "@/lib/complaints/types";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["contains", "startsWith", "eq", "neq"] as const;
const DATE_OPERATORS = ["gte", "lte"] as const;

/** Search box fields for POST /complaints/search (subset of the API's allowed query fields). */
export const COMPLAINT_BAR_OR_SEARCH_FIELDS = ["number", "subject", "callerPhone", "targets.label"] as const;

/** Built-in category keys; tenant-defined categories can still be matched with the text operators. */
const BUILT_IN_CATEGORY_KEYS = [
  "appointment",
  "delivery",
  "billing",
  "customer_service",
  "progress",
  "quality",
  "general",
  "other",
] as const;

export const COMPLAINT_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "status",
    label: "Status",
    operators: ["eq", "neq"],
    valueType: "select",
    options: COMPLAINT_STATUSES.map((value) => ({ value, label: value })),
  },
  {
    field: "severity",
    label: "Severity",
    operators: ["eq", "neq"],
    valueType: "select",
    options: COMPLAINT_SEVERITIES.map((value) => ({ value, label: value })),
  },
  {
    field: "category",
    label: "Category",
    operators: ["eq", "neq"],
    valueType: "select",
    options: BUILT_IN_CATEGORY_KEYS.map((value) => ({ value, label: value })),
  },
  { field: "number", label: "Number", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "C-2026-00001" },
  { field: "subject", label: "Subject", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter subject…" },
  { field: "callerPhone", label: "Caller phone", operators: ["eq", "startsWith", "contains"], valueType: "text", placeholder: "2015551234" },
  { field: "targets.label", label: "Target reference", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter reference…" },
  { field: "createdAt", label: "Created at", operators: [...DATE_OPERATORS], valueType: "text", placeholder: "YYYY-MM-DD" },
];
