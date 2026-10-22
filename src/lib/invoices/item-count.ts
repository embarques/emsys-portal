/** Count merchandise units, not line rows or barcode labels. */
export function sumInvoiceItemQuantities(items: readonly { quantity: unknown }[]): number {
  return items.reduce((total, item) => {
    const quantity = Number(item.quantity);
    return Number.isFinite(quantity) && quantity > 0 ? total + quantity : total;
  }, 0);
}

/** Preserve an authoritative API zero; derive only for older API responses. */
export function resolveInvoiceItemCount(value: unknown, items: readonly { quantity: unknown }[]): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : sumInvoiceItemQuantities(items);
}
