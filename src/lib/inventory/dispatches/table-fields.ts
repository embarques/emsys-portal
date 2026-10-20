import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for Swagger definitions["inventory.Dispatch"]. */
export const INVENTORY_DISPATCH_API_TABLE_FIELDS = [
  { field: "assigneeEmployeeId", defaultVisible: false },
  { field: "correctsSourceId", defaultVisible: false },
  { field: "dailyRouteId", defaultVisible: false },
  { field: "dispatchedAt", columnId: "date", format: "date" },
  { field: "fromHolderId", columnId: "fromHolder" },
  { field: "id", defaultVisible: false },
  { field: "lines", columnId: "lines" },
  { field: "notes", defaultVisible: false },
  { field: "postedAt", columnId: "postedAt", format: "date" },
  { field: "postedBy", defaultVisible: false },
  { field: "postingRevision", defaultVisible: false },
  { field: "status", columnId: "status" },
  { field: "toHolderId", columnId: "toHolder" },
  { field: "version", defaultVisible: false },
] as const satisfies readonly ApiTableField[];
