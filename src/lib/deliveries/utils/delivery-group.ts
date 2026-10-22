import type { Barcode } from "@/lib/barcodes/types";
import type { Invoice, InvoiceLineItemBarcode } from "@/lib/invoices/types";

export type DeliveryGroupItem = {
  lineItemId: string;
  description: string;
  barcodes: InvoiceLineItemBarcode[];
};

export type DeliveryGroup = NonNullable<ReturnType<typeof resolveDeliveryGroup>>;

/**
 * Resolve all invoice barcodes assigned to the selected delivery.
 */
export function resolveDeliveryGroup(
  selected: Pick<Barcode, "invoiceId" | "barcodeId" | "number" | "route" | "delivery">,
  invoice: Invoice,
) {
  const routeId = selected.route?.id.trim();
  if (!routeId || !selected.invoiceId || selected.invoiceId !== invoice.invoiceId) return null;

  const deliveryId = selected.delivery?.id != null ? String(selected.delivery.id) : "";
  if (!deliveryId || Number(deliveryId) <= 0) return null;
  const items: DeliveryGroupItem[] = [];
  const identities = new Set<string>();
  for (const item of invoice.lineItems) {
    const barcodes = (item.barcodes ?? []).filter((barcode) => {
      if (barcode.routeId !== routeId || barcode.deliveryId !== deliveryId) return false;
      // Numeric package sequence is not unique across invoice details.
      const identity = barcode.barcodeId || barcode.number;
      if (identities.has(identity)) return false;
      identities.add(identity);
      return true;
    });
    if (barcodes.length) items.push({
      lineItemId: item.apiId || item.id,
      description: item.description || item.itemName,
      barcodes,
    });
  }

  const barcodes = items.flatMap((item) => item.barcodes);
  const selectedStillAssigned = barcodes.some((barcode) =>
    selected.barcodeId && barcode.barcodeId
      ? selected.barcodeId === barcode.barcodeId
      : selected.number === barcode.number,
  );
  if (!selectedStillAssigned) return null;

  return {
    invoiceId: invoice.invoiceId,
    invoiceNumber: invoice.invoiceNumber,
    containerId: invoice.containerId,
    routeId,
    deliveryId,
    routeName: selected.route?.name || routeId,
    items,
    barcodeCount: barcodes.length,
    // The delivery receiver may differ; these only back the "same as invoice receiver" shortcut.
    invoiceReceiver: {
      name: invoice.receiver?.name?.trim() === "—" ? "" : invoice.receiver?.name?.trim() ?? "",
      idNumber: invoice.receiver?.documentId?.trim() ?? "",
    },
  };
}

export function deliveryGroupFingerprint(group: DeliveryGroup) {
  return JSON.stringify([group.invoiceId, group.routeId, group.deliveryId,
    group.items.flatMap((item) => item.barcodes.map((barcode) =>
      [item.lineItemId, item.description, barcode.barcodeId || barcode.number, barcode.number].join("|"),
    )).sort(),
  ]);
}

/** Embedded patches for group barcodes not already at the chosen status. */
export function buildDeliveryStatusPatches(group: DeliveryGroup, status: { id: number; name: string }) {
  const target = status.name.trim().toUpperCase();
  return group.items
    .flatMap((item) => item.barcodes)
    .filter((barcode) =>
      barcode.statusId != null && barcode.statusId > 0
        ? barcode.statusId !== status.id
        : (barcode.statusName ?? "").trim().toUpperCase() !== target,
    )
    .map((barcode) => ({
      barcodeId: barcode.barcodeId || barcode.id,
      number: barcode.number,
      status: { id: status.id, name: status.name },
    }));
}
