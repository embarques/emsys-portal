import { generateInvoiceReport } from "@/lib/reports/api/reports-api";
import type { ReportRequest, ReportResult } from "@/lib/reports/types";
import { isMongoObjectId } from "@/lib/utils/id";

type InvoiceReportLookup = Pick<ReportRequest, "values" | "lookupField">;

export function resolveInvoiceReportLookup(input: {
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  savedInvoiceId?: string | null;
}): InvoiceReportLookup | null {
  const savedId = input.savedInvoiceId?.trim();
  if (savedId && isMongoObjectId(savedId)) {
    return { values: [savedId], lookupField: "id" };
  }

  const invoiceId = input.invoiceId?.trim();
  if (invoiceId && isMongoObjectId(invoiceId)) {
    return { values: [invoiceId], lookupField: "id" };
  }

  const invoiceNumber = input.invoiceNumber?.trim();
  if (invoiceNumber) {
    return { values: [invoiceNumber], lookupField: "number" };
  }

  return null;
}

export async function printInvoiceReport(input: {
  invoiceId?: string | null;
  invoiceNumber?: string | null;
  savedInvoiceId?: string | null;
}): Promise<ReportResult> {
  const lookup = resolveInvoiceReportLookup(input);
  if (!lookup) {
    throw new Error("Enter an invoice number or save the invoice before printing.");
  }

  return generateInvoiceReport({
    type: "invoice",
    collection: "invoices",
    values: lookup.values,
    lookupField: lookup.lookupField,
  });
}

export function openInvoiceReportUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}
