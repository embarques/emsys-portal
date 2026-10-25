import type { Invoice, InvoiceListParams } from "./types";
import type { TableFilterRowState } from "@/lib/table/filter-builder";

export type MobileInvoiceView = "all" | "due" | "paid" | "incomplete";
export const MOBILE_INVOICE_BATCH_SIZE = 50;

export function mobileInvoiceParams(params: InvoiceListParams, view: MobileInvoiceView): InvoiceListParams {
  const filters: TableFilterRowState[] = [...(params.filterRows ?? [])];
  if (view !== "all") {
    filters.push({ id: "mobile-invoice-view", join: "and", field: view === "incomplete" ? "registration" : "balance", operator: view === "due" ? "gt" : "eq", value: view === "incomplete" ? "PENDING" : "0" });
  }
  return { ...params, page: 1, offset: undefined, limit: MOBILE_INVOICE_BATCH_SIZE, sort: "date:desc,id:desc", filterRows: filters };
}

export function nextMobileInvoicePage(last: { items: Invoice[]; total: number }, page: number): number | undefined {
  return last.items.length > 0 && page * MOBILE_INVOICE_BATCH_SIZE < last.total ? page + 1 : undefined;
}

export function uniqueMobileInvoices(pages: Array<{ items: Invoice[] }>): Invoice[] {
  const seen = new Set<string>();
  return pages.flatMap(page => page.items).filter(invoice => {
    if (seen.has(invoice.invoiceId)) return false;
    seen.add(invoice.invoiceId);
    return true;
  });
}
