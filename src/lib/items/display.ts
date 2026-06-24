import type { Item } from "./types";

export function formatItemDate(iso: string): string {
  if (!iso?.trim()) return "—";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
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

export function computeItemKpis(items: Item[]) {
  const totalValue = items.reduce((sum, item) => sum + item.price, 0);
  return {
    total: items.length,
    averagePrice: items.length > 0 ? totalValue / items.length : 0,
    totalValue,
  };
}
