import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for Swagger definitions["inventory.Receipt"]. */
export const INVENTORY_RECEIPT_API_TABLE_FIELDS = [
  // Raw workflow/confirmation/attribution state stays in typed inventory views and actions.
  { field: "allowedActions", column: false },
  { field: "audit", column: false },
  { field: "confirmations", column: false },
  { field: "dailyRoute", column: false },
  { field: "dailyRouteId", column: false },
  { field: "rejection", column: false },
  { field: "submittedAt", column: false },
  { field: "submittedBy", column: false },
  { field: "correctsSourceId", defaultVisible: false },
  { field: "id", defaultVisible: false },
  { field: "lines", columnId: "lines" },
  { field: "notes", defaultVisible: false },
  { field: "postedAt", columnId: "postedAt", format: "date" },
  { field: "postedBy", defaultVisible: false },
  { field: "postingRevision", defaultVisible: false },
  { field: "receivedAt", columnId: "date", format: "date" },
  { field: "status", columnId: "status" },
  { field: "supplierId", columnId: "supplier" },
  { field: "toHolderId", columnId: "holder" },
  { field: "version", defaultVisible: false },
] as const satisfies readonly ApiTableField[];
