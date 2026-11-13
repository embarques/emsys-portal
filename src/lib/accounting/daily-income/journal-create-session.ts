import {buildDailyIncomeJournalCreatePayload, createDailyIncomeJournalSync} from "@/lib/accounting/daily-income/api";
import type {JournalWriteOptions} from "./duplicate-payment";
import type {DailyIncomeJournal, DailyIncomeJournalValues, DailyIncomeStatement} from "./types";
import {createRandomId} from "@/lib/utils/id";

/** Keep uncertain submissions retryable without treating a later successful entry as a replay. */
export function createJournalCreateSession(
  send = createDailyIncomeJournalSync,
  newRequestId = createRandomId,
) {
  const attempts = new Map<string, {requestId: string; pending?: Promise<DailyIncomeJournal | null>}>();
  return async (scope: string, statement: DailyIncomeStatement, values: DailyIncomeJournalValues, options?: JournalWriteOptions) => {
    const key = JSON.stringify([scope, buildDailyIncomeJournalCreatePayload(statement, values, options)]);
    let attempt = attempts.get(key);
    if (attempt?.pending) return attempt.pending;
    if (!attempt) {
      attempt = {requestId: newRequestId()};
      attempts.set(key, attempt);
    }
    const current = attempt;
    current.pending = send(current.requestId, statement, values, options).then(journal => {
      attempts.delete(key);
      return journal;
    }).finally(() => { current.pending = undefined; });
    return current.pending;
  };
}
