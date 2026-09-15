import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["pickup.Pickup"]. */
export const ORDER_API_TABLE_FIELDS = [
  { field: "branch", columnId: "branch.code" },
  { field: "comments" },
  { field: "completed" },
  { field: "completedAt", format: "date" },
  { field: "completedBy" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "date", format: "date" },
  { field: "id" },
  { field: "legacySyncError" },
  { field: "legacySyncStatus" },
  { field: "legacySyncedAt", format: "date" },
  { field: "purpose" },
  { field: "receivers" },
  { field: "route", columnId: "route.name" },
  { field: "routeNumber" },
  { field: "sender", columnId: "sender.name" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
] as const satisfies readonly ApiTableField[];
