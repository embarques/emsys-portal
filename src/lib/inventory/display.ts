import type { InventoryCategory, InventoryItem, InventoryLocation, InventoryStatus } from "./types";
import { INVENTORY_CATEGORIES, INVENTORY_LOCATIONS, INVENTORY_STATUSES } from "./types";

export function getLocationLabel(location: InventoryLocation): string {
  return INVENTORY_LOCATIONS.find((entry) => entry.value === location)?.label ?? location;
}

export function getStatusLabel(status: InventoryStatus): string {
  return INVENTORY_STATUSES.find((entry) => entry.value === status)?.label ?? status;
}

export function getCategoryLabel(category: InventoryCategory): string {
  return INVENTORY_CATEGORIES.find((entry) => entry.value === category)?.label ?? category;
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

export function inventoryMatchesQuery(item: InventoryItem, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [item.sku, item.name, item.notes ?? "", getLocationLabel(item.location), getCategoryLabel(item.category)]
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
