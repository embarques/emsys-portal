import type { Invoice, InvoiceFormValues, InvoiceLineItem, InvoiceLineItemBarcode } from "@/lib/invoices/types";
import { resolveLineLabelCount } from "@/lib/invoices/types";

export type InvoiceBarcodeDecreaseNeed = {
  lineItemId: string;
  lineItemApiId?: string;
  description: string;
  currentCount: number;
  nextCount: number;
  removeCount: number;
  barcodes: InvoiceLineItemBarcode[];
};

export type InvoiceBarcodeSyncPlan = {
  /** Line items whose label count dropped — user must pick which barcodes to remove. */
  decreases: InvoiceBarcodeDecreaseNeed[];
  /** Line items that need additional barcodes created. */
  increases: Array<{
    lineItemId: string;
    description: string;
    createCount: number;
    existingCount: number;
    nextCount: number;
  }>;
  /** Line items whose description changed while barcode count stays the same. */
  descriptionUpdates: Array<{
    lineItemId: string;
    description: string;
    barcodes: InvoiceLineItemBarcode[];
  }>;
  /** Line items removed from the invoice — all barcodes should be deleted. */
  deletedLineItems: Array<{
    lineItemId: string;
    description: string;
    barcodes: InvoiceLineItemBarcode[];
  }>;
};

function lineItemDescription(item: Pick<InvoiceLineItem, "itemName" | "description">): string {
  return item.itemName.trim() || item.description?.trim() || "";
}

function formLineDescription(item: InvoiceFormValues["lineItems"][number]): string {
  return item.itemName.trim();
}

function matchOriginalLineItem(
  original: Invoice,
  formItem: InvoiceFormValues["lineItems"][number],
): InvoiceLineItem | undefined {
  const id = formItem.id.trim();
  return original.lineItems.find(
    (item) => item.id === id || item.apiId === id || (item.apiId != null && item.apiId === formItem.id),
  );
}

/**
 * Compare the loaded invoice with edited form values to decide barcode sync work.
 * Merchandise barcodes are owned by the invoice (line items + labels).
 */
export function planInvoiceBarcodeSync(
  original: Invoice,
  values: InvoiceFormValues,
): InvoiceBarcodeSyncPlan {
  const plan: InvoiceBarcodeSyncPlan = {
    decreases: [],
    increases: [],
    descriptionUpdates: [],
    deletedLineItems: [],
  };

  const matchedOriginalIds = new Set<string>();

  for (const formItem of values.lineItems) {
    const originalItem = matchOriginalLineItem(original, formItem);
    if (!originalItem) continue;

    matchedOriginalIds.add(originalItem.id);
    if (originalItem.apiId) matchedOriginalIds.add(originalItem.apiId);

    const barcodes = originalItem.barcodes ?? [];
    const nextCount = resolveLineLabelCount(formItem);
    const currentCount = barcodes.length > 0 ? barcodes.length : originalItem.labelCount;
    const nextDescription = formLineDescription(formItem);
    const previousDescription = lineItemDescription(originalItem);

    if (barcodes.length > 0 && nextCount < barcodes.length) {
      plan.decreases.push({
        lineItemId: originalItem.id,
        lineItemApiId: originalItem.apiId,
        description: nextDescription || previousDescription,
        currentCount: barcodes.length,
        nextCount,
        removeCount: barcodes.length - nextCount,
        barcodes,
      });
    } else if (nextCount > currentCount) {
      plan.increases.push({
        lineItemId: originalItem.id,
        description: nextDescription || previousDescription,
        createCount: nextCount - Math.max(barcodes.length, 0),
        existingCount: barcodes.length,
        nextCount,
      });
    } else if (
      barcodes.length > 0 &&
      nextCount === barcodes.length &&
      nextDescription &&
      nextDescription !== previousDescription
    ) {
      plan.descriptionUpdates.push({
        lineItemId: originalItem.id,
        description: nextDescription,
        barcodes,
      });
    }
  }

  for (const originalItem of original.lineItems) {
    const stillPresent =
      matchedOriginalIds.has(originalItem.id) ||
      (originalItem.apiId != null && matchedOriginalIds.has(originalItem.apiId));
    if (stillPresent) continue;

    const barcodes = originalItem.barcodes ?? [];
    if (barcodes.length === 0) continue;

    plan.deletedLineItems.push({
      lineItemId: originalItem.id,
      description: lineItemDescription(originalItem),
      barcodes,
    });
  }

  return plan;
}

export function invoiceBarcodeSyncNeedsUserInput(plan: InvoiceBarcodeSyncPlan): boolean {
  return plan.decreases.some((entry) => entry.removeCount > 0);
}

export type InvoiceBarcodeDeletionSelection = Record<string, string[]>;

/** Validate the user picked exactly `removeCount` barcode ids per decreased line item. */
export function areBarcodeDecreaseSelectionsComplete(
  plan: InvoiceBarcodeSyncPlan,
  selections: InvoiceBarcodeDeletionSelection,
): boolean {
  return plan.decreases.every((entry) => {
    const selected = selections[entry.lineItemId] ?? [];
    return selected.length === entry.removeCount;
  });
}
