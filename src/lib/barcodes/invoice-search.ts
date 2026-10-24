import type { TableFilterRowState } from "@/lib/table/filter-types";

export function buildInvoiceBarcodesHref(invoiceNumbers: string[]): string {
  const params = new URLSearchParams();
  for (const number of new Set(invoiceNumbers.map((value) => value.trim()).filter(Boolean))) {
    params.append("invoice", number);
  }
  return `/barcodes?${params.toString()}`;
}

export function invoiceBarcodeFilterRows(params: URLSearchParams): TableFilterRowState[] {
  return [...new Set(params.getAll("invoice").map((value) => value.trim()).filter(Boolean))].map(
    (number, index) => ({
      id: `invoice-${index}`,
      join: "or",
      field: "invoice.number",
      operator: "eq",
      value: number,
    }),
  );
}
