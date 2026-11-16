import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for Swagger definitions["inventory.Supplier"]. */
export const INVENTORY_SUPPLIER_API_TABLE_FIELDS = [
  // Audit is normalized into typed timestamps/actors; no additional raw-object column.
  { field: "audit", column: false },
  { field: "addresses", columnId: "addresses" },
  { field: "companyName", columnId: "companyName" },
  { field: "contacts", columnId: "contacts" },
  { field: "id", defaultVisible: false },
  { field: "isActive", columnId: "status" },
  { field: "version", defaultVisible: false },
] as const satisfies readonly ApiTableField[];
