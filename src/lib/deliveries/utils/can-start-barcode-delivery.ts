import type { Barcode } from "@/lib/barcodes/types";

/** Completion accepts pending CONDUCE pieces with an owning invoice and numeric delivery. */
export function canStartBarcodeDelivery(barcode: Barcode | null | undefined): boolean {
  const deliveryId = barcode?.delivery?.id;
  if (!barcode?.invoiceId?.trim() || deliveryId == null || !Number.isInteger(deliveryId) || deliveryId <= 0) return false;
  return barcode.status?.id != null
    ? barcode.status.id === 6
    : barcode.status?.name?.trim().toUpperCase() === "CONDUCE";
}
