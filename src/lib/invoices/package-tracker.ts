import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import type { Invoice } from "@/lib/invoices/types";

export type InvoicePackageTrackerEntry = {
  id: string;
  timestamp: string;
  performedBy: string;
  description: string;
  success?: boolean;
};

export function buildInvoicePackageTrackerEntries(invoice: Invoice): InvoicePackageTrackerEntry[] {
  const entries: InvoicePackageTrackerEntry[] = [];

  for (const item of invoice.lineItems) {
    for (const barcode of item.barcodes ?? []) {
      const performedBy = barcode.createdBy?.trim() || invoice.createdBy || DEFAULT_CREATED_BY;
      const createdAt = barcode.createdAt?.trim();
      const scanDate = barcode.scanDate?.trim();
      const status = barcode.statusName?.trim();

      if (createdAt) {
        entries.push({
          id: `${barcode.id}-created`,
          timestamp: createdAt,
          performedBy,
          description: `Label ${barcode.number} created for ${item.itemName}.`,
          success: true,
        });
      }

      if (scanDate && scanDate !== createdAt) {
        entries.push({
          id: `${barcode.id}-scan`,
          timestamp: scanDate,
          performedBy,
          description: status
            ? `Barcode ${barcode.number} scanned — ${status}.`
            : `Barcode ${barcode.number} scanned.`,
          success: true,
        });
      } else if (!createdAt && status) {
        entries.push({
          id: `${barcode.id}-status`,
          timestamp: invoice.updatedAt || invoice.createdAt,
          performedBy,
          description: `Barcode ${barcode.number} status: ${status}.`,
          success: true,
        });
      }
    }
  }

  return entries.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}
