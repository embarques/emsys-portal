import type { ChartAccountType } from "@/lib/accounting/chart-accounts/types";

/** Pill colors for chart / journal account type tags. */
export function getChartAccountTypeBadgeClass(type: ChartAccountType | string): string {
  switch (type) {
    case "ASSET":
      return "border-transparent bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
    case "EXPENSE":
      return "border-transparent bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
    case "REVENUE":
      return "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
    case "BANK":
      return "border-transparent bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300";
    case "LOAN":
      return "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
    case "LIABILITY":
      return "border-transparent bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300";
    case "EQUITY":
      return "border-transparent bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300";
    case "CONTRA-REVENUE":
      return "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}
