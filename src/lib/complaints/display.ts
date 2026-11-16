import { COMPLAINT_ATTACHMENT_TYPES, type ComplaintCategory } from "@/lib/complaints/types";

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Catalog lookups return the key itself when missing; tenant-defined values fall back to API text. */
function translateOr(t: Translate, key: string, fallback: string): string {
  const value = t(key);
  return value === key ? fallback : value;
}

/** `appointment_ref` → `Appointment ref`, for tenant-defined detail keys without a catalog entry. */
function humanizeKey(key: string): string {
  const spaced = key.replace(/_/g, " ").trim();
  return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : key;
}

export function complaintStatusLabel(t: Translate, status: string): string {
  return status ? translateOr(t, `complaints.statuses.${status}`, status) : t("common.empty.dash");
}

export function complaintSeverityLabel(t: Translate, severity: string): string {
  return severity ? translateOr(t, `complaints.severities.${severity}`, severity) : t("common.empty.dash");
}

export function complaintCategoryLabel(
  t: Translate,
  key: string,
  categories: readonly ComplaintCategory[] = [],
): string {
  if (!key) return t("common.empty.dash");
  const apiLabel = categories.find((category) => category.key === key)?.label ?? humanizeKey(key);
  return translateOr(t, `complaints.categories.${key}`, apiLabel);
}

export function complaintTargetKindLabel(t: Translate, kind: string): string {
  return translateOr(t, `complaints.targetKinds.${kind}`, humanizeKey(kind));
}

export function complaintDetailFieldLabel(t: Translate, key: string): string {
  return translateOr(t, `complaints.detailFields.${key}`, humanizeKey(key));
}

export function complaintDetailOptionLabel(t: Translate, value: string): string {
  return translateOr(t, `complaints.detailOptions.${value}`, value);
}

export function formatComplaintDetailValue(t: Translate, value: unknown): string {
  if (value === null || value === undefined || value === "") return t("common.empty.dash");
  if (typeof value === "boolean") return t(value ? "complaints.yes" : "complaints.no");
  if (Array.isArray(value)) return value.map((item) => formatComplaintDetailValue(t, item)).join(", ");
  if (typeof value === "string") return complaintDetailOptionLabel(t, value);
  return String(value);
}

export function complaintAttachmentTypeLabel(t: Translate, mimeType: string): string {
  const type = COMPLAINT_ATTACHMENT_TYPES.find((entry) => entry.mimeType === mimeType);
  return type ? t(`complaints.attachments.types.${type.id}`) : mimeType;
}

export function formatComplaintAttachmentSize(bytes: number, locale: string): string {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 0.1) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(megabytes)} MB`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.max(1, bytes / 1024))} KB`;
}

const SEVERITY_BADGE_CLASSES: Record<string, string> = {
  low: "border-transparent bg-muted text-muted-foreground",
  normal: "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  high: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  urgent: "border-transparent bg-red-500 text-white",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  open: "border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  in_progress: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  pending_customer: "border-transparent bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  resolved: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  closed: "border-transparent bg-muted text-muted-foreground",
  rejected: "border-transparent bg-muted text-muted-foreground line-through",
};

export function complaintSeverityBadgeClassName(severity: string): string {
  return SEVERITY_BADGE_CLASSES[severity] ?? "";
}

export function complaintStatusBadgeClassName(status: string): string {
  return STATUS_BADGE_CLASSES[status] ?? "";
}
