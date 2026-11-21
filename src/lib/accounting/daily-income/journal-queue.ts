import type { DailyIncomeJournal } from "./types";

export type JournalQueue = "reconciliation" | "clearance";

export type JournalQueueBlockReason = "inactive" | "notOutstanding" | "notAuthorized";

/**
 * Clearance requires an explicit backend action grant.
 * Reconciliation can confirm bank receipts while clearance remains outstanding;
 * clearing later still settles the payment and reconciles if still outstanding.
 */
export function getJournalQueueBlockReason(row: DailyIncomeJournal, queue: JournalQueue): JournalQueueBlockReason | null {
  if (row.reversedAt || row.voidedAt || row.transactionStatus === "VOIDED" || row.transactionStatus === "REVERSED") return "inactive";
  if (queue === "clearance") {
    if (row.reversalOf) return "inactive";
    if (row.clearanceStatus !== "OUTSTANDING") return "notOutstanding";
    return row.allowedActions?.clear === true ? null : "notAuthorized";
  }
  if (row.reconciliationStatus !== "OUTSTANDING") return "notOutstanding";
  return null;
}

export function isJournalQueueActionable(row: DailyIncomeJournal, queue: JournalQueue): boolean {
  return getJournalQueueBlockReason(row, queue) === null;
}
