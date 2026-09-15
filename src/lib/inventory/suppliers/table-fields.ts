import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["inventory.Supplier"]. */
export const INVENTORY_SUPPLIER_API_TABLE_FIELDS = [
  { field: "addresses" },
  { field: "companyName" },
  { field: "contactNames" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "emails" },
  { field: "id" },
  { field: "phones" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
] as const satisfies readonly ApiTableField[];
