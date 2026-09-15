import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["barcode.Barcode"]. */
export const BARCODE_API_TABLE_FIELDS = [
  { field: "barcodeId" },
  { field: "container" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "delivery" },
  { field: "description" },
  { field: "id" },
  { field: "invoice" },
  { field: "invoiceNumber" },
  { field: "name" },
  { field: "number" },
  { field: "route", columnId: "route.name" },
  { field: "scanDate", format: "date" },
  { field: "status" },
  { field: "tripNumber" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
] as const satisfies readonly ApiTableField[];
