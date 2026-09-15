import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["check.Check"]. */
export const CHECK_API_TABLE_FIELDS = [
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
