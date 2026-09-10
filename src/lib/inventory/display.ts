import { resolvePhoneDisplayValue } from "@/lib/utils/phone";
import type { TranslateFn } from "@/lib/feedback/messages";
import type { InventoryItem } from "./types";
import type { AdjustmentReason } from "./types/movements";
import { ADJUSTMENT_REASONS } from "./types/movements";
import type { InventoryDispatch, InventoryReceipt } from "./types/documents";
import { getInventoryDispatchToLabel } from "./types/documents";
import type { InventorySupplier } from "./types/suppliers";

function translateEnum(t: TranslateFn, key: string, fallback: string): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export function getAdjustmentReasonLabel(reason: AdjustmentReason, t: TranslateFn): string {
  return translateEnum(t, `inventory.adjustmentReasons.${reason}`, reason);
}

export function getAdjustmentReasonOptions(t: TranslateFn) {
  return ADJUSTMENT_REASONS.map((option) => ({
    value: option.value,
    label: getAdjustmentReasonLabel(option.value, t),
  }));
}

export function formatInventoryDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "—";

  const day = trimmed.slice(0, 10);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(day)
    ? new Date(`${day}T00:00:00`)
    : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function formatInventoryMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function toDateInputValue(iso?: string): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  if (iso?.trim()) {
    const match = iso.trim().match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1]!;
    const parsed = new Date(iso);
    if (!Number.isNaN(parsed.getTime())) {
      return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
    }
  }
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function getInventoryItemLabel(item: Pick<InventoryItem, "item">): string {
  return item.item;
}

export { getInventoryDispatchToLabel };

export function dispatchMatchesQuery(
  dispatch: InventoryDispatch,
  itemLabel: string,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [itemLabel, getInventoryDispatchToLabel(dispatch.dispatchedTo)]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeAverageCost(itemId: string, receipts: InventoryReceipt[]): number {
  let quantity = 0;
  let cost = 0;
  for (const receipt of receipts) {
    if (receipt.itemId !== itemId) continue;
    quantity += receipt.quantity;
    cost += receipt.quantity * receipt.averageCost;
  }
  return quantity > 0 ? cost / quantity : 0;
}

export function formatSupplierList(values: string[]): string {
  return values.filter(Boolean).join(" · ");
}

export function formatSupplierPhones(supplier: InventorySupplier): string {
  return formatSupplierList(
    supplier.phones.map((phone) => resolvePhoneDisplayValue(phone.number, phone.displayNumber)),
  );
}

export function supplierMatchesQuery(supplier: InventorySupplier, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    supplier.companyName,
    ...supplier.contactNames,
    ...supplier.addresses,
    ...supplier.emails,
    formatSupplierPhones(supplier),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function inventoryMatchesQuery(item: InventoryItem, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return item.item.toLowerCase().includes(normalized);
}

export function computeInventoryKpis(items: InventoryItem[]) {
  return {
    total: items.length,
    inStock: items.filter((item) => item.quantity > 0).length,
    outOfStock: items.filter((item) => item.quantity <= 0).length,
    totalUnits: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

export function getMovementDirectionLabel(direction: string, t: TranslateFn): string {
  const key = `inventory.directions.${direction}`;
  const translated = t(key);
  return translated === key ? direction : translated;
}

export function getReferenceTypeLabel(referenceType: string, t: TranslateFn): string {
  const key = `inventory.references.${referenceType}`;
  const translated = t(key);
  return translated === key ? referenceType : translated;
}
