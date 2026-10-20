import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["pickup.Pickup"]. */
export const ORDER_API_TABLE_FIELDS = [
  { field: "branch", columnId: "branch.code" },
  { field: "comments" },
  { field: "completed" },
  { field: "completedAt", format: "date", defaultVisible: false },
  { field: "completedBy", defaultVisible: false },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "date", format: "date" },
  { field: "id" },
  { field: "legacySyncError", defaultVisible: false },
  { field: "legacySyncStatus", defaultVisible: false },
  { field: "legacySyncedAt", format: "date", defaultVisible: false },
  { field: "purpose", defaultVisible: false },
  // An appointment can have several receivers; they are shown in the view sheet instead.
  { field: "receivers", column: false },
  { field: "route", columnId: "route.name", defaultVisible: false },
  { field: "routeNumber", defaultVisible: false },
  { field: "sender", columnId: "sender.name" },
  { field: "updatedAt", format: "date", defaultVisible: false },
  { field: "updatedBy", defaultVisible: false },
] as const satisfies readonly ApiTableField[];
