import type { DailyIncomeJournal } from "./types";

export type JournalQueue = "reconciliation" | "clearance";

export type JournalQueueBlockReason = "inactive" | "notOutstanding" | "notAuthorized";

/** Clearance requires an explicit backend action grant, separate from reconciliation. */
export function getJournalQueueBlockReason(row: DailyIncomeJournal, queue: JournalQueue): JournalQueueBlockReason | null {
  if (row.reversedAt || row.reversalOf || row.voidedAt || row.transactionStatus === "VOIDED" || row.transactionStatus === "REVERSED") return "inactive";
  if (queue === "clearance") {
    if (row.clearanceStatus !== "OUTSTANDING") return "notOutstanding";
    return row.allowedActions?.clear === true ? null : "notAuthorized";
  }
  return row.reconciliationStatus === "OUTSTANDING" ? null : "notOutstanding";
}

export function isJournalQueueActionable(row: DailyIncomeJournal, queue: JournalQueue): boolean {
  return getJournalQueueBlockReason(row, queue) === null;
}
