import type { DailyIncomeJournal } from "./types";

export type JournalQueue = "reconciliation" | "clearance";

/** Clearance requires an explicit backend action grant, separate from reconciliation. */
export function isJournalQueueActionable(row: DailyIncomeJournal, queue: JournalQueue): boolean {
  if (row.reversedAt || row.reversalOf) return false;
  return queue === "clearance"
    ? row.clearanceStatus === "OUTSTANDING" && row.allowedActions?.clear === true
    : row.reconciliationStatus === "OUTSTANDING";
}
