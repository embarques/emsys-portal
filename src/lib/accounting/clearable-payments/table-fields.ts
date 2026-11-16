import type { ApiTableField } from "@/lib/table/api-table-fields";

/**
 * Shared directory coverage for the actual payment response schemas:
 * definitions["deposit.Deposit"], definitions["zelle_payment.ZellePayment"],
 * definitions["credit_card_payment.CreditCardPayment"].
 */
export const CLEARABLE_PAYMENT_API_TABLE_FIELDS = [
  // Settlement/reversal evidence belongs to the lifecycle model, not raw generated columns.
  { field: "clearedBy", column: false },
  { field: "reversedAt", column: false },
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
