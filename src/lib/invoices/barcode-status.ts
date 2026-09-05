import type { Invoice } from "@/lib/invoices/types";

export type InvoiceBarcodeStatusRow = {
  id: string;
  invoiceNumber: string;
  barcode: string;
  status: string;
  quantity: number;
  labels: number;
  container: string;
  deliveryRoute: string;
  description: string;
};

export function buildInvoiceBarcodeStatusRows(invoice: Invoice): InvoiceBarcodeStatusRow[] {
  const rows: InvoiceBarcodeStatusRow[] = [];

  for (const item of invoice.lineItems) {
    for (const barcode of item.barcodes ?? []) {
      rows.push({
        id: barcode.id,
        invoiceNumber: invoice.invoiceNumber,
        barcode: barcode.number,
        status: barcode.statusName?.trim() || "—",
        quantity: item.quantity,
        labels: item.labelCount,
        container: barcode.containerName?.trim() || invoice.containerName?.trim() || "—",
        deliveryRoute:
          barcode.deliveryName?.trim() || barcode.routeName?.trim() || invoice.routeName?.trim() || "—",
        description: item.description?.trim() || item.itemName,
      });
    }
  }

  return rows;
}

export function resolveInvoiceBarcodeStatusRows(invoice: Invoice): InvoiceBarcodeStatusRow[] {
  return buildInvoiceBarcodeStatusRows(invoice);
}
