import { deleteBarcodes } from "@/lib/barcodes/api/barcodes-catalog-api";
import { removeInvoiceEmbeddedBarcodes } from "@/lib/invoices/api/invoices-api";
import type {
  InvoiceBarcodeDeletionSelection,
  InvoiceBarcodeSyncPlan,
} from "@/lib/invoices/barcode-sync";
import type { Invoice, InvoiceLineItemBarcode } from "@/lib/invoices/types";
import {
  createBarcode,
  fetchBarcodeByNumber,
  generateLabels,
  updateBarcode,
  type BarcodeWritePayload,
} from "@/lib/labels/api/barcodes-api";
import { NEW_BARCODE_STATUS } from "@/lib/labels/types";

function barcodeIdentity(barcode: InvoiceLineItemBarcode): string {
  return barcode.barcodeId?.trim() || barcode.id.trim() || barcode.number.trim();
}

function collectDeletionIdentities(
  plan: InvoiceBarcodeSyncPlan,
  selections: InvoiceBarcodeDeletionSelection,
): { ids: string[]; numbers: string[] } {
  const ids = new Set<string>();
  const numbers = new Set<string>();

  const consider = (barcode: InvoiceLineItemBarcode, selected: boolean) => {
    if (!selected) return;
    const id = barcodeIdentity(barcode);
    if (id) ids.add(id);
    if (barcode.number.trim()) numbers.add(barcode.number.trim());
  };

  for (const entry of plan.decreases) {
    const selected = new Set(selections[entry.lineItemId] ?? []);
    for (const barcode of entry.barcodes) {
      consider(barcode, selected.has(barcodeIdentity(barcode)));
    }
  }

  for (const entry of plan.deletedLineItems) {
    for (const barcode of entry.barcodes) {
      consider(barcode, true);
    }
  }

  return { ids: [...ids], numbers: [...numbers] };
}

async function deleteCatalogBarcodesByNumbers(numbers: string[]): Promise<void> {
  const catalogIds: number[] = [];
  for (const number of numbers) {
    try {
      const found = await fetchBarcodeByNumber(number);
      if (found.id > 0) catalogIds.push(found.id);
    } catch {
      // Embed-only barcodes may not exist in `/barcodes`.
    }
  }
  if (catalogIds.length > 0) {
    await deleteBarcodes(catalogIds);
  }
}

/** Delete barcodes removed by label-count decrease or deleted line items. Call before invoice PUT. */
export async function applyInvoiceBarcodeDeletions(input: {
  invoiceId: string;
  plan: InvoiceBarcodeSyncPlan;
  deletions: InvoiceBarcodeDeletionSelection;
}): Promise<void> {
  const { ids, numbers } = collectDeletionIdentities(input.plan, input.deletions);
  if (ids.length === 0) return;

  await removeInvoiceEmbeddedBarcodes(input.invoiceId, ids);
  await deleteCatalogBarcodesByNumbers(numbers);
}

/**
 * After invoice PUT: create missing labels and sync descriptions onto catalog rows.
 * Prefer invoice-owned creation (`generateLabels`) when a line item has no barcodes yet.
 */
export async function applyInvoiceBarcodeCreatesAndDescriptionSync(input: {
  invoice: Invoice;
  plan: InvoiceBarcodeSyncPlan;
  container?: { id: number; name: string };
}): Promise<void> {
  const { invoice, plan, container } = input;
  const invoiceId = invoice.invoiceId;

  for (const entry of plan.increases) {
    if (entry.createCount <= 0) continue;

    if (entry.existingCount === 0) {
      await generateLabels([{ invoiceId, lineItemId: entry.lineItemId }]);
      continue;
    }

    await Promise.all(
      Array.from({ length: entry.createCount }, (_item, index) =>
        createBarcode({
          number: `${invoice.invoiceNumber || invoiceId}-${entry.lineItemId}-${entry.existingCount + index + 1}`,
          status: NEW_BARCODE_STATUS,
          container,
          description: entry.description || undefined,
        }),
      ),
    );
  }

  for (const entry of plan.descriptionUpdates) {
    for (const barcode of entry.barcodes) {
      const number = barcode.number.trim();
      if (!number) continue;
      try {
        const found = await fetchBarcodeByNumber(number);
        if (found.id <= 0) continue;
        const payload: BarcodeWritePayload = {
          number: found.number,
          status:
            found.status?.id != null && found.status.name?.trim()
              ? { id: found.status.id, name: found.status.name.trim() }
              : NEW_BARCODE_STATUS,
          container:
            found.container?.id != null
              ? { id: found.container.id, name: found.container.name }
              : undefined,
          description: entry.description,
        };
        await updateBarcode(found.id, payload);
      } catch {
        // Description sync is best-effort when catalog rows are missing.
      }
    }
  }
}
