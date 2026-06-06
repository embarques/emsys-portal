import type { Item } from "./types";

export function formatItemDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatItemPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);
}

export function truncateItemId(itemId: string): string {
  return itemId.length > 12 ? `${itemId.slice(0, 8)}…` : itemId;
}

export function itemMatchesQuery(item: Item, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    item.itemId,
    item.description,
    item.createdBy,
    formatItemPrice(item.price),
    formatItemDate(item.createdAt),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeItemKpis(items: Item[]) {
  const totalValue = items.reduce((sum, item) => sum + item.price, 0);
  return {
    total: items.length,
    averagePrice: items.length > 0 ? totalValue / items.length : 0,
    totalValue,
  };
}
