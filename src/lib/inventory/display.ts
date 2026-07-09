import type { TranslateFn } from "@/lib/feedback/messages";
import type { InventoryCategory, InventoryItem, InventoryLocation, InventoryStatus } from "./types";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_LOCATIONS,
  INVENTORY_STATUSES,
} from "./types";
import type { DispatchStatus } from "./types/documents";
import { DISPATCH_STATUSES } from "./types/documents";
import type { AdjustmentReason } from "./types/movements";
import { ADJUSTMENT_REASONS } from "./types/movements";
import type { RecipientType } from "./types/recipients";
import { RECIPIENT_TYPES } from "./types/recipients";

function translateEnum(t: TranslateFn, key: string, fallback: string): string {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export function getLocationLabel(location: InventoryLocation, t: TranslateFn): string {
  return translateEnum(t, `inventory.locations.${location}`, location);
}

export function getStatusLabel(status: InventoryStatus, t: TranslateFn): string {
  return translateEnum(t, `inventory.statuses.${status}`, status);
}

export function getCategoryLabel(category: InventoryCategory, t: TranslateFn): string {
  return translateEnum(t, `inventory.categories.${category}`, category);
}

export function getRecipientTypeLabel(type: RecipientType | string, t: TranslateFn): string {
  return translateEnum(t, `inventory.recipientTypes.${type}`, type);
}

export function getDispatchStatusLabel(status: DispatchStatus, t: TranslateFn): string {
  return translateEnum(t, `inventory.dispatchStatuses.${status}`, status);
}

export function getAdjustmentReasonLabel(reason: AdjustmentReason, t: TranslateFn): string {
  return translateEnum(t, `inventory.adjustmentReasons.${reason}`, reason);
}

export function getInventoryStatusOptions(t: TranslateFn) {
  return INVENTORY_STATUSES.map((option) => ({
    value: option.value,
    label: getStatusLabel(option.value, t),
  }));
}

export function getInventoryLocationOptions(t: TranslateFn) {
  return INVENTORY_LOCATIONS.map((option) => ({
    value: option.value,
    label: getLocationLabel(option.value, t),
  }));
}

export function getInventoryCategoryOptions(t: TranslateFn) {
  return INVENTORY_CATEGORIES.map((option) => ({
    value: option.value,
    label: getCategoryLabel(option.value, t),
  }));
}

export function getRecipientTypeOptions(t: TranslateFn) {
  return RECIPIENT_TYPES.map((option) => ({
    value: option.value,
    label: getRecipientTypeLabel(option.value, t),
  }));
}

export function getAdjustmentReasonOptions(t: TranslateFn) {
  return ADJUSTMENT_REASONS.map((option) => ({
    value: option.value,
    label: getAdjustmentReasonLabel(option.value, t),
  }));
}

export function formatInventoryDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function getAvailableQuantity(item: InventoryItem): number {
  return Math.max(item.quantity - item.reserved, 0);
}

export function getStatusBadgeClass(status: InventoryStatus): string {
  switch (status) {
    case "in_stock":
      return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "low_stock":
      return "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "out_of_stock":
      return "border-transparent bg-destructive/15 text-destructive";
    case "reserved":
      return "border-transparent bg-primary/15 text-primary";
    case "review":
      return "border-transparent bg-secondary text-secondary-foreground";
    default:
      return "";
  }
}

export function inventoryMatchesQuery(item: InventoryItem, query: string, t: TranslateFn): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    item.sku,
    item.name,
    item.notes ?? "",
    getLocationLabel(item.location, t),
    getCategoryLabel(item.category, t),
    getStatusLabel(item.status, t),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeInventoryKpis(items: InventoryItem[]) {
  return {
    total: items.length,
    inStock: items.filter((item) => item.status === "in_stock").length,
    lowStock: items.filter((item) => item.status === "low_stock").length,
    needsReview: items.filter((item) => item.status === "review" || item.status === "out_of_stock").length,
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
