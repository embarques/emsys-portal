import { CHANGE_RESOURCES } from "@/lib/change-requests/schemas/change-request.schema";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["contains", "startsWith", "eq", "neq"] as const;
const DATE_OPERATORS = ["gte", "lte"] as const;

export const CHANGE_REQUEST_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export const CHANGE_REQUEST_ACTIONS = ["UPDATE", "VOID"] as const;

/** Search box fields for POST /change-requests/search. */
export const CHANGE_REQUEST_BAR_OR_SEARCH_FIELDS = ["resourceId", "requestedBy.name", "reviewedBy.name"] as const;

/** Subset of the API's accepted change-request filter fields. */
export const CHANGE_REQUEST_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "status",
    label: "Status",
    operators: ["eq", "neq"],
    valueType: "select",
    options: CHANGE_REQUEST_STATUSES.map((value) => ({ value, label: value })),
  },
  {
    field: "action",
    label: "Action",
    operators: ["eq", "neq"],
    valueType: "select",
    options: CHANGE_REQUEST_ACTIONS.map((value) => ({ value, label: value })),
  },
  {
    field: "resourceType",
    label: "Record type",
    operators: ["eq", "neq"],
    valueType: "select",
    options: CHANGE_RESOURCES.map((value) => ({ value, label: value })),
  },
  { field: "resourceId", label: "Record ID", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter record ID…" },
  { field: "requestedBy.name", label: "Requested by", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter name…" },
  { field: "reviewedBy.name", label: "Reviewed by", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter name…" },
  { field: "createdAt", label: "Created at", operators: [...DATE_OPERATORS], valueType: "text", placeholder: "YYYY-MM-DD" },
  { field: "reviewedAt", label: "Reviewed at", operators: [...DATE_OPERATORS], valueType: "text", placeholder: "YYYY-MM-DD" },
];
