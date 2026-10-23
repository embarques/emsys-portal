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

/** Called synchronously from the user's print action, before any await. */
export function reserveInvoiceReportWindow(title: string, message: string): Window | null {
  const target = window.open("", "_blank");
  if (target) {
    target.opener = null;
    target.document.title = title;
    target.document.body.textContent = message;
  }
  return target;
}

export function openInvoiceReportUrl(url: string, target?: Window | null): boolean {
  if (target !== undefined) {
    if (!target || target.closed) return false;
    target.location.replace(url);
    return true;
  }
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
