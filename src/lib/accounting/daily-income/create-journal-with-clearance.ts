import { isBankTransaction } from "./auto-clear";
import type { JournalWriteOptions } from "./duplicate-payment";
import type { DailyIncomeJournal, DailyIncomeJournalValues, DailyIncomeStatement } from "./types";

type Input = { statement: DailyIncomeStatement; values: DailyIncomeJournalValues; options?: JournalWriteOptions };
type Dependencies = {
  canClear: boolean;
  create: (input: Input) => Promise<DailyIncomeJournal | null>;
  clear: (command: { requestId: string; ids: string[] }) => Promise<{ data: { cleared: string[]; clearedAt: string } }>;
  newRequestId: () => string;
};

/** The API settles and reconciles bank transactions atomically on clearance. */
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
      cleared = { ...journal, clearanceStatus: "CLEARED" as const, reconciliationStatus: "RECONCILED" as const, clearedAt: result.data.clearedAt };
    } catch {
      // Creation succeeded. Callers report unconfirmed clearance from the returned
      // status and must not retry journal creation (which would duplicate payment).
      return journal;
    }
  }
  return cleared;
}
