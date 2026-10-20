import { formatAuditDateTime } from "@/lib/audit/display";
import { formatPhoneForDisplay } from "@/lib/utils/phone";
import type { TranslateFn } from "@/lib/feedback/messages";
import type { InventoryItem, InventoryItemStockSummary } from "./types/catalog";
import { EMPTY_ITEM_STOCK_SUMMARY } from "./types/catalog";
import type { InventoryDocumentStatus, InventoryStockCondition } from "./types/common";
import type { InventoryDispatch, InventoryReceipt } from "./types/documents";
import type { InventoryHolder, InventoryHolderType } from "./types/holders";
import type { AdjustmentReason } from "./types/movements";
import { ADJUSTMENT_REASONS } from "./types/movements";
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

export function getDocumentStatusLabel(status: InventoryDocumentStatus, t: TranslateFn): string {
  return translateEnum(t, `inventory.documentStatuses.${status}`, status);
}

export function getHolderTypeLabel(type: InventoryHolderType, t: TranslateFn): string {
  return translateEnum(t, `inventory.holderTypes.${type}`, type);
}

export function getStockConditionLabel(condition: InventoryStockCondition, t: TranslateFn): string {
  return translateEnum(t, `inventory.stockConditions.${condition}`, condition);
}

export const DOCUMENT_STATUS_BADGE_CLASSES: Record<InventoryDocumentStatus, string> = {
  DRAFT: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  POSTED: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  CANCELLED: "border-border bg-muted text-muted-foreground",
};

export function formatInventoryDate(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "—";

  const day = trimmed.slice(0, 10);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${day}T00:00:00`)
    : new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function formatInventoryDateTime(value: string): string {
  return formatAuditDateTime(value);
}

export function formatInventoryMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

/** Integer USD cents → currency text. */
export function formatInventoryMinor(minor: number | null | undefined): string {
  if (minor == null || !Number.isFinite(minor)) return "—";
  return formatInventoryMoney(minor / 100);
}

export function getInventoryItemLabel(item: Pick<InventoryItem, "name">): string {
  return item.name;
}

export function getItemNameById(itemId: string, items: InventoryItem[]): string {
  return items.find((item) => item.id === itemId)?.name || itemId;
}

export function getSupplierNameById(supplierId: string, suppliers: InventorySupplier[]): string {
  return suppliers.find((supplier) => supplier.id === supplierId)?.companyName || supplierId;
}

export function getHolderNameById(holderId: string, holders: InventoryHolder[]): string {
  if (!holderId) return "";
  return holders.find((holder) => holder.id === holderId)?.displayName || holderId;
}

/** "Box ×30 · Barrel ×10", truncated with a "+N" suffix after `max` lines. */
export function summarizeDocumentLines(
  lines: { itemId: string; quantity: number }[],
  items: InventoryItem[],
  max = 2,
): string {
  const parts = lines.slice(0, max).map((line) => `${getItemNameById(line.itemId, items)} ×${line.quantity}`);
  const remaining = lines.length - max;
  return remaining > 0 ? `${parts.join(" · ")} +${remaining}` : parts.join(" · ");
}

function matches(values: string[], query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return values.join(" ").toLowerCase().includes(normalized);
}

export function receiptMatchesQuery(
  receipt: InventoryReceipt,
  query: string,
  context: { items: InventoryItem[]; suppliers: InventorySupplier[]; holders: InventoryHolder[]; statusLabel: string },
): boolean {
  return matches(
    [
      ...receipt.lines.map((line) => getItemNameById(line.itemId, context.items)),
      getSupplierNameById(receipt.supplierId, context.suppliers),
      getHolderNameById(receipt.toHolderId, context.holders),
      context.statusLabel,
      receipt.notes,
    ],
    query,
  );
}

export function dispatchMatchesQuery(
  dispatch: InventoryDispatch,
  query: string,
  context: { items: InventoryItem[]; holders: InventoryHolder[]; statusLabel: string },
): boolean {
  return matches(
    [
      ...dispatch.lines.map((line) => getItemNameById(line.itemId, context.items)),
      getHolderNameById(dispatch.fromHolderId, context.holders),
      getHolderNameById(dispatch.toHolderId, context.holders),
      context.statusLabel,
      dispatch.notes,
    ],
    query,
  );
}

export function formatSupplierList(values: string[]): string {
  return values.filter(Boolean).join(" · ");
}

export function formatSupplierContactNames(supplier: InventorySupplier): string {
  return formatSupplierList(supplier.contacts.map((contact) => contact.name));
}

export function formatSupplierPhones(supplier: InventorySupplier): string {
  return formatSupplierList(supplier.contacts.map((contact) => (contact.phone ? formatPhoneForDisplay(contact.phone) : "")));
}

export function formatSupplierEmails(supplier: InventorySupplier): string {
  return formatSupplierList(supplier.contacts.map((contact) => contact.email));
}

export function supplierMatchesQuery(supplier: InventorySupplier, query: string): boolean {
  return matches(
    [
      supplier.companyName,
      ...supplier.addresses,
      ...supplier.contacts.flatMap((contact) => [contact.name, contact.phone, contact.email]),
    ],
    query,
  );
}

export function inventoryMatchesQuery(item: InventoryItem, query: string): boolean {
  return matches([item.name, item.sku, item.category], query);
}

export function getItemStockSummary(
  itemId: string,
  summaries: Map<string, InventoryItemStockSummary>,
): InventoryItemStockSummary {
  return summaries.get(itemId) ?? EMPTY_ITEM_STOCK_SUMMARY;
}

export function computeInventoryKpis(items: InventoryItem[], summaries: Map<string, InventoryItemStockSummary>) {
  const active = items.filter((item) => item.isActive);
  const available = (item: InventoryItem) => getItemStockSummary(item.id, summaries).available;
  return {
    total: active.length,
    inStock: active.filter((item) => available(item) > 0).length,
    outOfStock: active.filter((item) => available(item) <= 0).length,
    totalUnits: active.reduce((sum, item) => sum + available(item), 0),
  };
}
