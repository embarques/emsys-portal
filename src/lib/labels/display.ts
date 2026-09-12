import type { TranslateFn } from "@/lib/feedback/messages";

export function getBarcodeStatusLabel(statusName: string, t: TranslateFn): string {
  const trimmed = statusName.trim();
  if (!trimmed) return trimmed;
  const key = `labels.barcodeStatuses.${trimmed}`;
  const translated = t(key);
  return translated === key ? trimmed : translated;
}

export function formatLabelTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function truncateBarcode(barcode: string): string {
  return barcode.length > 18 ? `${barcode.slice(0, 14)}…` : barcode;
}
