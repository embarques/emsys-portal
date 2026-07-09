import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import type { Invoice } from "@/lib/invoices/types";

export type InvoicePackageTrackerEntry = {
  id: string;
  timestamp: string;
  performedBy: string;
  description: string;
  success?: boolean;
};

export function getMockInvoicePackageTrackerEntries(invoice: Invoice): InvoicePackageTrackerEntry[] {
  const itemName = invoice.lineItems[0]?.itemName ?? "shipment";
  const baseTime = new Date(invoice.createdAt).getTime();

  return [
    {
      id: `mock-pt-${invoice.invoiceId}-1`,
      timestamp: new Date(baseTime + 2 * 60 * 60 * 1000).toISOString(),
      performedBy: invoice.createdBy || DEFAULT_CREATED_BY,
      description: `Label generated for ${itemName}.`,
      success: true,
    },
    {
      id: `mock-pt-${invoice.invoiceId}-2`,
      timestamp: new Date(baseTime + 26 * 60 * 60 * 1000).toISOString(),
      performedBy: invoice.createdBy || DEFAULT_CREATED_BY,
      description: "Package scanned at warehouse intake.",
      success: true,
    },
    {
      id: `mock-pt-${invoice.invoiceId}-3`,
      timestamp: new Date(baseTime + 72 * 60 * 60 * 1000).toISOString(),
      performedBy: "Route Scanner",
      description: "Loaded on delivery route — out for delivery.",
      success: true,
    },
  ];
}
