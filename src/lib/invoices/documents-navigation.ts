import type { Invoice } from "@/lib/invoices/types";

// Stable feature/entity identity lets the workspace focus an existing document tab.
export function invoiceDocumentTabOptions(
  invoice: Pick<Invoice, "invoiceId" | "invoiceNumber">,
) {
  return {
    feature: "invoice-documents",
    baseHref: "/invoices",
    mode: "edit" as const,
    entityId: invoice.invoiceId,
    label: invoice.invoiceNumber,
  };
}
