import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["invoicedescription.InvoiceDescription"]. */
export const ITEM_API_TABLE_FIELDS = [
  { field: "createdAt", format: "date" },
  { field: "id", columnId: "itemId" },
  { field: "name", columnId: "description" },
  { field: "price" },
  { field: "updatedAt", format: "date" },
] as const satisfies readonly ApiTableField[];
