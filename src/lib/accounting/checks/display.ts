import type { CheckStatus } from "./types";

export function getCheckStatusBadgeClass(status: CheckStatus): string {
  switch (status) {
    case "OUTSTANDING":
      return "bg-amber-500/10 text-amber-800 dark:text-amber-300";
    case "CLEARED":
      return "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
    default:
      return "";
  }
}
