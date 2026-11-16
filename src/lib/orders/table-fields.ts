import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for .reference/emsys-api/docs/swagger.json definitions["pickup.Pickup"]. */
export const ORDER_API_TABLE_FIELDS = [
  // Route-stop order and lifecycle/attribution metadata stay in their dedicated workflows.
  // orderNumber is distinct from the legacy routeNumber compatibility field below.
  { field: "dailyRoute", column: false },
  { field: "orderNumber", column: false },
  { field: "voidReason", column: false },
  { field: "voidedAt", column: false },
  { field: "voidedBy", column: false },
  { field: "branch", columnId: "branch.code" },
  { field: "comments" },
  { field: "completed" },
  { field: "completedAt", format: "date", defaultVisible: false, sortField: "completedAt" },
  { field: "completedBy", defaultVisible: false, sortField: "completedBy.name" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "date", format: "date" },
  { field: "id" },
  { field: "legacySyncError", defaultVisible: false, sortField: "legacySyncError" },
  { field: "legacySyncStatus", defaultVisible: false, sortField: "legacySyncStatus" },
  { field: "legacySyncedAt", format: "date", defaultVisible: false, sortField: "legacySyncedAt" },
  { field: "purpose", defaultVisible: false, sortField: "purpose" },
  // An appointment can have several receivers; they are shown in the view sheet instead.
  { field: "receivers", column: false },
  { field: "route", columnId: "route.name", defaultVisible: false },
  { field: "routeNumber", defaultVisible: false, sortField: "routeNumber" },
  { field: "sender", columnId: "sender.name" },
  { field: "updatedAt", format: "date", defaultVisible: false },
  { field: "updatedBy", defaultVisible: false, sortField: "updatedBy.name" },
] as const satisfies readonly ApiTableField[];
