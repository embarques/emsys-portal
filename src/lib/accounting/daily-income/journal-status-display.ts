import type { DailyIncomeJournal, JournalTransactionType } from "@/lib/accounting/daily-income/types";

type ReconciliationStatus = NonNullable<DailyIncomeJournal["reconciliationStatus"]>;
type ClearanceStatus = NonNullable<DailyIncomeJournal["clearanceStatus"]>;

/** Pill colors for journal reconciliation status. */
export function getJournalReconciliationStatusBadgeClass(status: ReconciliationStatus | string): string {
  switch (status) {
    case "RECONCILED":
      return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "OUTSTANDING":
      return "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "NOT_REQUIRED":
      return "border-transparent bg-muted text-muted-foreground";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

/** Pill colors for journal clearance status. */
export function getJournalClearanceStatusBadgeClass(status: ClearanceStatus | string): string {
  switch (status) {
    case "CLEARED":
      return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "OUTSTANDING":
      return "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300";
    case "NOT_REQUIRED":
      return "border-transparent bg-muted text-muted-foreground";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

/** Pill colors for journal transaction type (aligned with type picker accents). */
export function getJournalTransactionTypeBadgeClass(type: JournalTransactionType | string): string {
  switch (type) {
    case "INITIAL-PAYMENT":
    case "TRANSFER":
      return "border-transparent bg-blue-500/15 text-blue-700 dark:text-blue-300";
    case "PAYMENT":
    case "SALES":
      return "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "EXPENSE":
      return "border-transparent bg-rose-500/15 text-rose-700 dark:text-rose-300";
    case "INVENTORY":
      return "border-transparent bg-teal-500/15 text-teal-700 dark:text-teal-300";
    case "DISCOUNT":
      return "border-transparent bg-violet-500/15 text-violet-700 dark:text-violet-300";
    case "SURCHARGE":
      return "border-transparent bg-orange-500/15 text-orange-700 dark:text-orange-300";
    case "LOAN":
    case "LOAN-PAYMENT":
    case "LOAN-DECREASE":
      return "border-transparent bg-indigo-500/15 text-indigo-700 dark:text-indigo-300";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}
