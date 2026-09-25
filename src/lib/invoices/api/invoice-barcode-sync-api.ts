import type {
  InvoiceBarcodeDeletionSelection,
  InvoiceBarcodeSyncPlan,
  InvoiceRemoveBarcodeIdsByDetail,
} from "@/lib/invoices/barcode-sync";
import {
  buildRemoveBarcodeIdsByDetail,
  canSubmitBarcodeDecreases,
} from "@/lib/invoices/barcode-sync";

/**
 * Resolve barcode ObjectIDs for `removeBarcodeIds` on invoice PUT when labels decrease.
 * Must send exactly `currentCount - labels` IDs; API keeps the rest and mirrors deletes to `/barcodes`.
 * Portal must not rewrite barcode arrays.
 */
export function resolveInvoiceRemoveBarcodeIds(input: {
  plan: InvoiceBarcodeSyncPlan;
  deletions: InvoiceBarcodeDeletionSelection;
}): InvoiceRemoveBarcodeIdsByDetail {
  if (!canSubmitBarcodeDecreases(input.plan, input.deletions)) {
    throw new Error(
      "Lowering labels requires selecting exactly currentCount - labels distinct barcode ObjectIDs to remove.",
    );
  }

  return buildRemoveBarcodeIdsByDetail(input.plan, input.deletions);
}
