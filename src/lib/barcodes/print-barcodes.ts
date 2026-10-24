import type { Barcode } from "@/lib/barcodes/types";
import { buildSelectedLabelReportRequest } from "@/lib/labels/print-label-report";

export function barcodeSelectionKey(barcode: Pick<Barcode, "barcodeId" | "id">): string {
  return barcode.barcodeId?.trim() || String(barcode.id);
}

/** Never silently print a subset or substitute a possibly duplicated label number. */
export function buildBarcodePrintRequest(barcodes: Pick<Barcode, "barcodeId" | "id">[]) {
  if (barcodes.length === 0) return null;
  const ids = barcodes.map((barcode) =>
    barcode.barcodeId?.trim() || (barcode.id > 0 ? String(barcode.id) : ""),
  );
  if (ids.some((id) => !id)) return null;
  const values = [...new Set(ids)];
  return { ...buildSelectedLabelReportRequest(values), values };
}
