import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for .reference/emsys-api/docs/swagger.json definitions["check.Check"]. */
export const CHECK_API_TABLE_FIELDS = [
  // Settlement/reversal evidence is retained by the lifecycle model, not added as raw columns.
  { field: "clearedBy", column: false },
  { field: "reversedAt", column: false },
  { field: "paymentReference", columnId: "checkNumber" },
  { field: "checkNumber" },
  { field: "clearedAt", format: "date" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "datePosted" },
  { field: "id" },
  { field: "invoice", columnId: "invoiceNumber" },
  { field: "journal" },
  { field: "paymentAmount" },
  { field: "refNumber" },
  { field: "status" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
] as const satisfies readonly ApiTableField[];
