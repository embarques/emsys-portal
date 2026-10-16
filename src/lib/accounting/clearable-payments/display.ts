import type { ClearablePaymentStatus } from "./types";

export function getClearablePaymentStatusBadgeClass(status: ClearablePaymentStatus): string {
  switch (status) {
    case "OUTSTANDING":
      return "bg-red-500/10 text-red-700 dark:text-red-300";
    case "CLEARED":
      return "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
    default:
      return "";
  }
}
