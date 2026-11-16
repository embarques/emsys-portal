import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for .reference/emsys-api/docs/swagger.json definitions["barcode.Barcode"]. */
export const BARCODE_API_TABLE_FIELDS = [
  // Void evidence belongs to the protected lifecycle/detail workflow, not raw directory columns.
  { field: "voidReason", column: false },
  { field: "voidedAt", column: false },
  { field: "voidedBy", column: false },
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
