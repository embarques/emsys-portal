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
 * Resolve Barcode column values for `removeBarcodeIds` for invoice PUT when labels decrease.
 * The API deletes from embed + catalog; portal must not rewrite barcode arrays.
 */
export function resolveInvoiceRemoveBarcodeIds(input: {
  plan: InvoiceBarcodeSyncPlan;
  deletions: InvoiceBarcodeDeletionSelection;
}): InvoiceRemoveBarcodeIdsByDetail {
  if (!canSubmitBarcodeDecreases(input.plan, input.deletions)) {
    throw new Error(
      "Lowering labels requires selecting one distinct, nonempty barcode number per removed label.",
    );
  }

  return buildRemoveBarcodeIdsByDetail(input.plan, input.deletions);
}
