import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { createRandomId } from "@/lib/utils/id";
import { translateCurrent } from "@/lib/i18n/translate-current";
import { buildDailyIncomeJournalCreatePayload, normalizeJournal } from "./api";
import type { JournalWriteOptions } from "./duplicate-payment";
import type { DailyIncomeJournal, DailyIncomeJournalValues, DailyIncomeStatement } from "./types";

export type JournalCorrectionInput = { journal: DailyIncomeJournal; statement: DailyIncomeStatement; values: DailyIncomeJournalValues; options?: JournalWriteOptions };

/** One mounted editor owns this command identity; identical retries reuse it. */
export function createJournalCorrector() {
  let retry: { key: string; requestId: string } | null = null;
  return async (input: JournalCorrectionInput, reason: string) => {
    const replacement = buildDailyIncomeJournalCreatePayload(input.statement, {
      ...input.values, autoClear: false, autoReconcile: false, clearPaymentOnSave: false,
    }, input.options);
    const body = { expectedVersion: input.journal.version, reason, replacement };
    const key = JSON.stringify({ id: input.journal.id, ...body });
    if (retry?.key !== key) retry = { key, requestId: createRandomId() };
    const response = await apiClient.post<{ success?: boolean; message?: string; data?: { replacement?: unknown } }>(
      `${API_ENDPOINTS.ACCOUNTING_JOURNALS}/${encodeURIComponent(input.journal.id)}/correct`,
      { ...body, requestId: retry.requestId },
    );
    const journal = normalizeJournal(response.data?.replacement);
    if (response.success === false || !journal?.id) throw new Error(response.message || translateCurrent("accounting.journalLifecycle.unconfirmed"));
    return journal;
  };
}
