import type { UserActivitySeverity } from "@/lib/user-activities/types";

export function getUserActivitySeverityClass(severity: UserActivitySeverity): string {
  switch (severity) {
    case "uncommon":
      return "text-amber-700 dark:text-amber-300";
    case "rare":
      return "text-red-700 dark:text-red-400";
    case "common":
    default:
      return "";
  }
}

export function formatUserActivityQuantity(
  quantity: number | null,
  dash: string,
): string {
  if (quantity == null || !Number.isFinite(quantity)) return dash;
  return String(quantity);
}

export function formatUserActivityOrigin(origin: string, dash: string): string {
  const trimmed = origin.trim();
  return trimmed || dash;
}
