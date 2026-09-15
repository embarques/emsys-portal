import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["inventory.Item"]. */
export const INVENTORY_ITEM_API_TABLE_FIELDS = [
  { field: "averageCost" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "id" },
  { field: "item" },
  { field: "quantity", columnId: "quantityLeft" },
  { field: "reorderThreshold" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
] as const satisfies readonly ApiTableField[];
