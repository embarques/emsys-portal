import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for Swagger definitions["inventory.Item"]. */
export const INVENTORY_ITEM_API_TABLE_FIELDS = [
  // Audit is normalized into typed timestamps/actors; do not dump the nested object into a column.
  { field: "audit", column: false },
  { field: "category", columnId: "category" },
  { field: "currency", defaultVisible: false },
  { field: "defaultSellingPriceMinor", columnId: "defaultSellingPrice" },
  { field: "id", defaultVisible: false },
  { field: "isActive", columnId: "status" },
  { field: "name", columnId: "item" },
  { field: "reorderThreshold" },
  { field: "sku", columnId: "sku" },
  { field: "unitOfMeasure", columnId: "unitOfMeasure" },
  { field: "version", defaultVisible: false },
] as const satisfies readonly ApiTableField[];
