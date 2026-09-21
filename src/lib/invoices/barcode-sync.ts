import type { Invoice, InvoiceFormValues, InvoiceLineItem, InvoiceLineItemBarcode } from "@/lib/invoices/types";
import { resolveLineLabelCount } from "@/lib/invoices/types";
import { isMongoObjectId } from "@/lib/utils/id";

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
  /** Line items that need additional barcodes created (API mints on PUT). */
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

/** Prefer ObjectID `barcodeId` for API `removeBarcodeIds`. */
export function invoiceBarcodeObjectId(barcode: InvoiceLineItemBarcode): string | null {
  const objectId = barcode.barcodeId?.trim();
  return objectId && isMongoObjectId(objectId) ? objectId : null;
}

export function invoiceBarcodeSelectionKey(barcode: InvoiceLineItemBarcode): string {
  return invoiceBarcodeObjectId(barcode) || barcode.id.trim() || barcode.number.trim();
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
    const removable = barcodes.filter((barcode) => invoiceBarcodeObjectId(barcode));
    const nextCount = resolveLineLabelCount(formItem);
    const currentCount = barcodes.length > 0 ? barcodes.length : originalItem.labelCount;
    const nextDescription = formLineDescription(formItem);
    const previousDescription = lineItemDescription(originalItem);

    if (nextCount < currentCount) {
      const removeCount = currentCount - nextCount;
      plan.decreases.push({
        lineItemId: originalItem.id,
        lineItemApiId: originalItem.apiId,
        description: nextDescription || previousDescription,
        currentCount,
        nextCount,
        removeCount,
        // Only ObjectID barcodes can be sent as removeBarcodeIds.
        barcodes: removable.length > 0 ? removable : barcodes,
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

/** detail ObjectID / line item id → ObjectID barcodeIds to remove on PUT. */
export type InvoiceRemoveBarcodeIdsByDetail = Record<string, string[]>;

/** Validate the user picked exactly `removeCount` barcode ids per decreased line item. */
export function areBarcodeDecreaseSelectionsComplete(
  plan: InvoiceBarcodeSyncPlan,
  selections: InvoiceBarcodeDeletionSelection,
): boolean {
  return plan.decreases.every((entry) => {
    const selected = selections[entry.lineItemId] ?? [];
    if (selected.length !== entry.removeCount) return false;

    const allowed = new Set(
      entry.barcodes
        .map((barcode) => invoiceBarcodeObjectId(barcode) || invoiceBarcodeSelectionKey(barcode))
        .filter(Boolean),
    );
    return selected.every((id) => allowed.has(id));
  });
}

/**
 * Build per-detail `removeBarcodeIds` (ObjectIDs only) for `PUT /invoices/{id}`.
 * Keys prefer the invoice-detail API id so the write payload can attach them.
 */
export function buildRemoveBarcodeIdsByDetail(
  plan: InvoiceBarcodeSyncPlan,
  selections: InvoiceBarcodeDeletionSelection,
): InvoiceRemoveBarcodeIdsByDetail {
  const byDetail: InvoiceRemoveBarcodeIdsByDetail = {};

  for (const entry of plan.decreases) {
    if (entry.removeCount <= 0) continue;

    const selected = new Set(selections[entry.lineItemId] ?? []);
    const objectIds: string[] = [];

    for (const barcode of entry.barcodes) {
      const key = invoiceBarcodeSelectionKey(barcode);
      if (!selected.has(key)) continue;
      const objectId = invoiceBarcodeObjectId(barcode);
      if (objectId) objectIds.push(objectId);
    }

    const detailKey = entry.lineItemApiId?.trim() || entry.lineItemId.trim();
    if (detailKey && objectIds.length > 0) {
      byDetail[detailKey] = objectIds;
    }
  }

  return byDetail;
}

/** True when every decrease has enough ObjectID `barcodeId` values to satisfy the API. */
export function canSubmitBarcodeDecreases(
  plan: InvoiceBarcodeSyncPlan,
  selections: InvoiceBarcodeDeletionSelection,
): boolean {
  if (!areBarcodeDecreaseSelectionsComplete(plan, selections)) return false;

  const byDetail = buildRemoveBarcodeIdsByDetail(plan, selections);
  return plan.decreases.every((entry) => {
    if (entry.removeCount <= 0) return true;
    const detailKey = entry.lineItemApiId?.trim() || entry.lineItemId.trim();
    const ids = byDetail[detailKey] ?? [];
    return ids.length === entry.removeCount && ids.every((id) => isMongoObjectId(id));
  });
}
