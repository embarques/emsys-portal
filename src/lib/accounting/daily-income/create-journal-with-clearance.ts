import { isBankTransaction } from "./auto-clear";
import type { JournalWriteOptions } from "./duplicate-payment";
import type { DailyIncomeJournal, DailyIncomeJournalValues, DailyIncomeStatement } from "./types";

type Input = { statement: DailyIncomeStatement; values: DailyIncomeJournalValues; options?: JournalWriteOptions };
type Dependencies = {
  canClear: boolean;
  canReconcile: boolean;
  create: (input: Input) => Promise<DailyIncomeJournal | null>;
  clear: (command: { requestId: string; ids: string[] }) => Promise<{ data: { cleared: string[]; clearedAt: string } }>;
  reconcile: (command: { requestId: string; ids: string[] }) => Promise<{ data: { reconciled: string[]; reconciledAt: string } }>;
  newRequestId: () => string;
};

/** Bank payments are reconciled only after they clear, so reconciliation follows a confirmed clearance. */
export async function createJournalWithClearance(input: Input, dependencies: Dependencies) {
  const requested = Boolean(input.values.clearPaymentOnSave);
  if (requested && (!isBankTransaction(input.values) || (input.values.amount ?? 0) <= 0 || !dependencies.canClear)) {
    throw new Error("Bank transaction clearance requires permission to clear journals.");
  }
  const journal = await dependencies.create(input);
  if (!journal || !requested) return journal;
  let cleared = journal;
  if (journal.clearanceStatus !== "CLEARED") {
    try {
      const result = await dependencies.clear({ requestId: dependencies.newRequestId(), ids: [journal.id] });
      if (!result.data.cleared.includes(journal.id)) return journal;
      cleared = { ...journal, clearanceStatus: "CLEARED" as const, clearedAt: result.data.clearedAt };
    } catch {
      // Creation succeeded. Callers report unconfirmed clearance from the returned
      // status and must not retry journal creation (which would duplicate payment).
      return journal;
    }
  }
  return reconcileClearedJournal(cleared, dependencies);
}

async function reconcileClearedJournal(journal: DailyIncomeJournal, dependencies: Dependencies) {
  if (journal.reconciliationStatus !== "OUTSTANDING" || !dependencies.canReconcile) return journal;
  try {
    const result = await dependencies.reconcile({ requestId: dependencies.newRequestId(), ids: [journal.id] });
    if (result.data.reconciled.includes(journal.id)) {
      return { ...journal, reconciliationStatus: "RECONCILED" as const, reconciledAt: result.data.reconciledAt };
    }
  } catch {
    // The cleared journal stays in Pending Reconciliation, where it can still be reconciled.
  }
  return journal;
}
