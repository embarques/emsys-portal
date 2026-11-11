import type { DailyIncomeJournal } from "./types";

export type JournalQueue = "reconciliation" | "clearance";

export type JournalQueueBlockReason = "inactive" | "notOutstanding" | "notAuthorized" | "awaitingClearance";

/** Clearance requires an explicit backend action grant. Bank transactions reconcile only once cleared. */
export function getJournalQueueBlockReason(row: DailyIncomeJournal, queue: JournalQueue): JournalQueueBlockReason | null {
  if (row.reversedAt || row.reversalOf || row.voidedAt || row.transactionStatus === "VOIDED" || row.transactionStatus === "REVERSED") return "inactive";
  if (queue === "clearance") {
    if (row.clearanceStatus !== "OUTSTANDING") return "notOutstanding";
    return row.allowedActions?.clear === true ? null : "notAuthorized";
  }
  if (row.reconciliationStatus !== "OUTSTANDING") return "notOutstanding";
  return row.clearanceStatus === "OUTSTANDING" ? "awaitingClearance" : null;
}

export function isJournalQueueActionable(row: DailyIncomeJournal, queue: JournalQueue): boolean {
  return getJournalQueueBlockReason(row, queue) === null;
}
