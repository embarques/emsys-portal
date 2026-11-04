import type { DailyIncomeJournal, DailyIncomeStatement, JournalTransactionType } from "./types";

export type JournalEditBlockReason = "closeout" | "type" | "reconciled" | "cleared" | "restricted" | "reversed";

/**
 * Invoice registrations follow the invoice lifecycle (`PUT /journals` rejects them);
 * inventory moves stock and loans use their own APIs, so the generic form cannot re-post them.
 */
const NON_EDITABLE_TYPES = new Set<JournalTransactionType | "VOID">(["INITIAL-PAYMENT", "INVENTORY", "LOAN", "VOID"]);

/** Why a journal cannot be edited from Daily Income, or null when it can. The API remains authoritative. */
export function journalEditBlockReason(
  journal: DailyIncomeJournal,
  currentCloseout: DailyIncomeStatement | null | undefined,
): JournalEditBlockReason | null {
  if (!currentCloseout || currentCloseout.status !== "OPEN" || journal.incomeStatementId !== currentCloseout.id) {
    return "closeout";
  }
  if (NON_EDITABLE_TYPES.has(journal.transactionType)) return "type";
  if (journal.clearanceStatus === "CLEARED") return "cleared";
  if (journal.allowedActions?.edit === false) return "restricted";
  if (journal.reconciliationStatus === "RECONCILED") return "reconciled";
  if (journal.reversedAt || journal.reversalOf) return "reversed";
  return null;
}
