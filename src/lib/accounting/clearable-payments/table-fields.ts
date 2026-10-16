import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Assumed directory coverage mirroring check.Check for clearable payments. */
export const CLEARABLE_PAYMENT_API_TABLE_FIELDS = [
  { field: "paymentReference", columnId: "paymentReference" },
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
