import { formatContainerLabel } from "@/lib/containers/display";
import { getContainerById } from "@/lib/containers/mock-data";
import type { TranslateFn } from "@/lib/feedback/messages";
import type { Invoice } from "@/lib/invoices/types";

import type { LabelActivityEntry, LabelStatus, ShipmentLabel } from "./types";

export function getLabelStatusLabel(status: LabelStatus, t: TranslateFn): string {
  return t(`labels.statuses.${status}`);
}

export function getBarcodeStatusLabel(statusName: string, t: TranslateFn): string {
  const trimmed = statusName.trim();
  if (!trimmed) return trimmed;
  const key = `labels.barcodeStatuses.${trimmed}`;
  const translated = t(key);
  return translated === key ? trimmed : translated;
}

export function formatActivityAction(action: LabelActivityEntry["action"], t: TranslateFn): string {
  const key = `labels.activity.actions.${action}`;
  const translated = t(key);
  return translated === key ? action : translated;
}

export function getLabelStatusBadgeClass(status: LabelStatus): string {
  switch (status) {
    case "pending":
      return "border-transparent bg-muted text-muted-foreground";
    case "generated":
      return "border-transparent bg-primary/15 text-primary";
    case "printed":
      return "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "in_transit":
      return "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300";
    case "delivered":
      return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "cancelled":
      return "border-transparent bg-destructive/15 text-destructive";
    default:
      return "";
  }
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

export function getLabelContainerLabel(containerId: string, t?: TranslateFn): string {
  const container = getContainerById(containerId);
  if (!container) return t ? t("labels.unknownContainer") : "Unknown container";
  return formatContainerLabel(container);
}

export function truncateBarcode(barcode: string): string {
  return barcode.length > 18 ? `${barcode.slice(0, 14)}…` : barcode;
}

export function labelMatchesQuery(label: ShipmentLabel, query: string, t: TranslateFn): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    label.invoiceNumber,
    label.barcode,
    label.description,
    getLabelStatusLabel(label.status, t),
    getLabelContainerLabel(label.containerId, t),
    String(label.totalLabels),
    String(label.quantity),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeLabelKpis(labels: ShipmentLabel[]) {
  return {
    total: labels.length,
    generated: labels.filter((label) => label.status === "generated").length,
    printed: labels.filter((label) => label.status === "printed").length,
    inTransit: labels.filter((label) => label.status === "in_transit").length,
  };
}

function activityBarcodes(entry: LabelActivityEntry): string[] {
  return entry.barcode
    .split(/,\s*/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function buildInvoiceLabelActivityTimeline(
  invoice: Invoice,
  activityLog: LabelActivityEntry[],
  labels: ShipmentLabel[]
): LabelActivityEntry[] {
  const invoiceActivity = activityLog.filter((entry) => entry.invoiceNumber === invoice.invoiceNumber);
  const barcodesWithActivity = new Set(invoiceActivity.flatMap(activityBarcodes));

  const invoiceLabels = labels.filter((label) => label.invoiceId === invoice.invoiceId);
  const syntheticEntries: LabelActivityEntry[] = invoiceLabels
    .filter((label) => !barcodesWithActivity.has(label.barcode))
    .map((label) => ({
      id: `synthetic-${label.labelId}`,
      labelId: label.labelId,
      barcode: label.barcode,
      invoiceNumber: label.invoiceNumber,
      action: "generate" as const,
      message: `Label ${label.labelSequence}/${label.totalLabels} created for ${label.description}.`,
      success: true,
      timestamp: label.createdAt,
      performedBy: label.createdBy,
    }));

  return [...invoiceActivity, ...syntheticEntries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}
