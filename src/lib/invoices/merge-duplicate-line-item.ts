import {
  computeLineTotal,
  resolveLineLabelCount,
  resolveLineTotal,
  type InvoiceLineItemFormValues,
} from "@/lib/invoices/types";

/** Trim, collapse whitespace, and ignore case so typed vs catalog names still match. */
export function normalizeInvoiceLineItemDescription(description: string): string {
  return description.trim().replace(/\s+/g, " ").toLowerCase();
}

export function invoiceLineItemDescriptionsMatch(left: string, right: string): boolean {
  const normalizedLeft = normalizeInvoiceLineItemDescription(left);
  const normalizedRight = normalizeInvoiceLineItemDescription(right);
  return Boolean(normalizedLeft) && normalizedLeft === normalizedRight;
}

export function findInvoiceLineItemWithDescription(
  items: InvoiceLineItemFormValues[],
  description: string,
  excludeId?: string | null,
): InvoiceLineItemFormValues | undefined {
  return items.find(
    (item) =>
      item.id !== excludeId && invoiceLineItemDescriptionsMatch(item.itemName, description),
  );
}

function sumNumericFields(left: string, right: string): number {
  const leftValue = Number(left);
  const rightValue = Number(right);
  return (Number.isFinite(leftValue) ? leftValue : 0) + (Number.isFinite(rightValue) ? rightValue : 0);
}

/** Fold a duplicate description into the existing line by adding quantity and labels. */
export function mergeInvoiceLineItemQuantities(
  existing: InvoiceLineItemFormValues,
  incoming: InvoiceLineItemFormValues,
): InvoiceLineItemFormValues {
  const quantity = sumNumericFields(existing.quantity, incoming.quantity);
  const quantityString = String(quantity);
  const labelCount = resolveLineLabelCount(existing) + resolveLineLabelCount(incoming);
  const labelsManual =
    existing.labelsManual || incoming.labelsManual || String(labelCount) !== quantityString;

  const merged: InvoiceLineItemFormValues = {
    ...existing,
    itemId: existing.itemId || incoming.itemId,
    quantity: quantityString,
    labelCount: String(labelCount),
    labelsManual,
  };

  if (existing.totalManual || incoming.totalManual) {
    merged.lineTotal = (resolveLineTotal(existing) + resolveLineTotal(incoming)).toFixed(2);
    merged.totalManual = true;
    return merged;
  }

  const unitPrice = Number(existing.unitPrice);
  merged.lineTotal = computeLineTotal(quantity, Number.isFinite(unitPrice) ? unitPrice : 0).toFixed(2);
  merged.totalManual = false;
  return merged;
}

/** Replace or append a line, merging into an existing row when the description already exists. */
export function commitInvoiceLineItemWithUniqueDescription(
  committedItems: InvoiceLineItemFormValues[],
  incoming: InvoiceLineItemFormValues,
  editingId: string | null = null,
): { items: InvoiceLineItemFormValues[]; mergedIntoId: string | null } {
  const excludeId = editingId ?? incoming.id;
  const duplicate = findInvoiceLineItemWithDescription(
    committedItems,
    incoming.itemName,
    excludeId,
  );

  if (duplicate) {
    const merged = mergeInvoiceLineItemQuantities(duplicate, incoming);
    const items = committedItems
      .filter((item) => item.id !== editingId)
      .map((item) => (item.id === duplicate.id ? merged : item));
    return { items, mergedIntoId: duplicate.id };
  }

  if (editingId) {
    return {
      items: committedItems.map((item) => (item.id === editingId ? incoming : item)),
      mergedIntoId: null,
    };
  }

  return { items: [...committedItems, incoming], mergedIntoId: null };
}
