import { formatContainerIdLabel } from "@/lib/containers/display";
import { getBarcodeStatusLabel } from "@/lib/labels/display";
import type { Barcode } from "@/lib/labels/types";
import type { TranslateFn } from "@/lib/feedback/messages";

export function formatBarcodeId(id: number): string {
  return formatContainerIdLabel(String(id));
}

export function formatBarcodeNumber(number: string): string {
  return number.trim() || "—";
}

export function formatBarcodeContainer(
  container: Barcode["container"],
  t: TranslateFn,
): string {
  if (!container?.name?.trim()) {
    return t("common.empty.dash");
  }

  return container.name.trim();
}

export function formatBarcodeDeliveryRoute(
  route: Barcode["route"],
  t: TranslateFn,
): string {
  if (!route) return t("common.empty.dash");

  const name = route.name?.trim();
  const routeId = route.routeId?.trim();
  if (name && routeId && name !== routeId) {
    return `${name} (${routeId})`;
  }

  return name || routeId || route.id?.trim() || t("common.empty.dash");
}

export function formatBarcodeDelivery(
  delivery: Barcode["delivery"],
  t: TranslateFn,
): string {
  if (!delivery?.name?.trim()) {
    return t("common.empty.dash");
  }

  return delivery.name.trim();
}

export function formatBarcodeTripNumber(tripNumber: number | undefined, t: TranslateFn): string {
  if (tripNumber == null || !Number.isFinite(tripNumber) || tripNumber <= 0) {
    return t("common.empty.dash");
  }

  return String(tripNumber);
}

export function formatBarcodeStatus(
  status: Barcode["status"],
  t: TranslateFn,
): string {
  const name = status?.name?.trim();
  if (!name) return t("common.empty.dash");
  return getBarcodeStatusLabel(name, t);
}

export function getBarcodeStatusBadgeClass(statusName: string): string {
  const normalized = statusName.trim().toUpperCase();

  switch (normalized) {
    case "CREATED":
      return "border-transparent bg-primary/15 text-primary";
    case "PRINTED":
      return "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "IN TRANSIT":
      return "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300";
    case "CONDUCE":
      return "border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300";
    case "DELIVERED":
      return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "CANCELLED":
      return "border-transparent bg-destructive/15 text-destructive";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

export function formatBarcodeScanDate(scanDate: string | undefined, locale: string): string {
  const trimmed = scanDate?.trim();
  if (!trimmed) return "—";

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return trimmed;

  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function computeBarcodeKpis(barcodes: Barcode[]) {
  const normalize = (value: string | undefined) => value?.trim().toUpperCase() ?? "";

  return {
    total: barcodes.length,
    created: barcodes.filter((barcode) => normalize(barcode.status?.name) === "CREATED").length,
    printed: barcodes.filter((barcode) => normalize(barcode.status?.name) === "PRINTED").length,
    inTransit: barcodes.filter((barcode) => normalize(barcode.status?.name) === "IN TRANSIT").length,
    delivered: barcodes.filter((barcode) => normalize(barcode.status?.name) === "DELIVERED").length,
  };
}
