import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for Swagger definitions["inventory.Dispatch"]. */
export const INVENTORY_DISPATCH_API_TABLE_FIELDS = [
  // Raw workflow/confirmation/custody state is handled by typed inventory views and actions.
  { field: "allowedActions", column: false },
  { field: "audit", column: false },
  { field: "confirmations", column: false },
  { field: "dailyRoute", column: false },
  { field: "incomeRecipients", column: false },
  { field: "lineProgress", column: false },
  { field: "pendingReconciliationCount", column: false },
  { field: "reconciliation", column: false },
  { field: "rejection", column: false },
  { field: "responsibleHolderIds", column: false },
  { field: "salesRecordedAtDispatch", column: false },
  { field: "submittedAt", column: false },
  { field: "submittedBy", column: false },
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
