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
        container: barcode.containerName?.trim() || "—",
        deliveryRoute: barcode.deliveryName?.trim() || "—",
        description: item.description?.trim() || item.itemName,
      });
    }
  }

  return rows;
}

export function getMockInvoiceBarcodeStatusRows(invoice: Invoice): InvoiceBarcodeStatusRow[] {
  const primaryItem = invoice.lineItems[0];
  if (!primaryItem) return [];

  return [
    {
      id: `mock-bc-${invoice.invoiceId}-1`,
      invoiceNumber: invoice.invoiceNumber,
      barcode: `${invoice.invoiceNumber.replace(/\D/g, "").slice(-4)}-LBL-001`,
      status: "In transit",
      quantity: primaryItem.quantity,
      labels: primaryItem.labelCount,
      container: invoice.containerName?.trim() || `Container ${invoice.containerId}`,
      deliveryRoute: invoice.routeName?.trim() || "Santo Domingo — Zone 1",
      description: primaryItem.description?.trim() || primaryItem.itemName,
    },
    {
      id: `mock-bc-${invoice.invoiceId}-2`,
      invoiceNumber: invoice.invoiceNumber,
      barcode: `${invoice.invoiceNumber.replace(/\D/g, "").slice(-4)}-LBL-002`,
      status: "Printed",
      quantity: primaryItem.quantity,
      labels: primaryItem.labelCount,
      container: invoice.containerName?.trim() || `Container ${invoice.containerId}`,
      deliveryRoute: invoice.routeName?.trim() || "Santo Domingo — Zone 1",
      description: primaryItem.description?.trim() || primaryItem.itemName,
    },
  ];
}

export function resolveInvoiceBarcodeStatusRows(invoice: Invoice): InvoiceBarcodeStatusRow[] {
  const fromInvoice = buildInvoiceBarcodeStatusRows(invoice);
  if (fromInvoice.length > 0) return fromInvoice;
  return getMockInvoiceBarcodeStatusRows(invoice);
}
