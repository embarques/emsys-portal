import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["inventory.Dispatch"]. */
export const INVENTORY_DISPATCH_API_TABLE_FIELDS = [
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "dispatchedAt", columnId: "date", format: "date" },
  { field: "dispatchedTo" },
  { field: "id" },
  { field: "incomeGained" },
  { field: "item" },
  { field: "itemId" },
  { field: "journal" },
  { field: "quantity" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
] as const satisfies readonly ApiTableField[];
