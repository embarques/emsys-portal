import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["inventory.Receipt"]. */
export const INVENTORY_RECEIPT_API_TABLE_FIELDS = [
  { field: "averageCost" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "id" },
  { field: "item" },
  { field: "itemId" },
  { field: "journal" },
  { field: "quantity" },
  { field: "receivedAt", columnId: "date", format: "date" },
  { field: "supplier" },
  { field: "supplierId" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
] as const satisfies readonly ApiTableField[];
