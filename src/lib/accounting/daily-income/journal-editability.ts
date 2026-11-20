import type { DailyIncomeJournal, DailyIncomeStatement, JournalTransactionType } from "./types";

export type JournalEditBlockReason = "closeout" | "type" | "reconciled" | "cleared" | "restricted" | "reversed";

/**
 * Mirrors API `dedicatedLifecycle` plus inventory transaction type.
 * Invoice registrations, inventory, loans and voids/reversals use dedicated workflows;
 * `PUT /journals/{id}` rejects them.
 */
const NON_EDITABLE_TYPES = new Set<string>([
  "INITIAL-PAYMENT",
  "INVENTORY",
  "LOAN",
  "LOAN-PAYMENT",
  "LOAN-DECREASE",
  "VOID",
  "REVERSAL",
]);

function isInventoryBackedSource(sourceSystem: string | undefined): boolean {
  return sourceSystem === "inventory_receipt" || sourceSystem === "inventory_dispatch";
}

/** Why a journal cannot be edited from Daily Income, or null when it can. The API remains authoritative. */
export function journalEditBlockReason(
  journal: DailyIncomeJournal,
  currentCloseout: DailyIncomeStatement | null | undefined,
): JournalEditBlockReason | null {
  if (!currentCloseout || currentCloseout.status !== "OPEN" || journal.incomeStatementId !== currentCloseout.id) {
    return "closeout";
  }
  if (
    NON_EDITABLE_TYPES.has(journal.transactionType) ||
    journal.loan != null ||
    journal.sourceSystem === "legacy-api" ||
    isInventoryBackedSource(journal.sourceSystem)
  ) {
    return "type";
  }
  if (journal.transactionStatus === "VOIDED" || journal.transactionStatus === "REVERSED") return "reversed";
  if (journal.clearanceStatus === "CLEARED") return "cleared";
  if (journal.reconciliationStatus === "RECONCILED") return "reconciled";
  if (journal.reconciliationStatus === "NOT_REQUIRED") return "reversed";
  if (journal.pendingChange === true) return "restricted";
  if (journal.allowedActions?.edit !== true || !journal.version || journal.version < 1) return "restricted";
  if (journal.reversedAt || journal.reversalOf || journal.voidedAt) return "reversed";
  return null;
}

/** Transaction types the generic Daily Income editor may attempt to re-post. */
export function isGenericEditableTransactionType(type: JournalTransactionType | string): boolean {
  return !NON_EDITABLE_TYPES.has(type);
}
