"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { translateCurrent } from "@/lib/i18n/translate-current";
import { createJournalCorrector } from "./journal-correction-api";
import { useUpdateDailyIncomeJournal } from "./hooks";
import { invalidateJournalLifecycle } from "./journal-lifecycle-cache";
import { journalEditOperation } from "./journal-editability";
import type { JournalWriteOptions } from "./duplicate-payment";
import type { DailyIncomeJournal, DailyIncomeJournalValues, DailyIncomeStatement } from "./types";

type EditInput = { journal: DailyIncomeJournal; statement: DailyIncomeStatement; values: DailyIncomeJournalValues; options?: JournalWriteOptions; canUpdate: boolean };
type PendingCorrection = { input: EditInput; resolve: (journal: DailyIncomeJournal | null) => void };

/** Keeps uncertain corrections bound to the same UUID and payload in this editor. */
export function useJournalEdit() {
  const { companyId } = useAuth();
  const client = useQueryClient();
  const update = useUpdateDailyIncomeJournal();
  const [pending, setPending] = useState<PendingCorrection | null>(null);
  const active = useRef<Promise<DailyIncomeJournal | null> | null>(null);
  const confirming = useRef(false);
  const [correct] = useState(createJournalCorrector);
  const correction = useMutation({
    retry: false,
    mutationFn: ({ input, reason }: { input: EditInput; reason: string }) => correct(input, reason),
    onSuccess: async (_journal, { input }) => {
      await invalidateJournalLifecycle(client, companyId, { id: input.journal.id, invoiceId: input.journal.invoice?.id ? String(input.journal.invoice.id) : undefined });
      if (_journal.invoice?.id && _journal.invoice.id !== input.journal.invoice?.id) {
        await invalidateJournalLifecycle(client, companyId, { id: _journal.id, invoiceId: String(_journal.invoice.id) });
      }
    },
  });

  function save(input: EditInput): Promise<DailyIncomeJournal | null> {
    if (active.current) return active.current;
    const operation = journalEditOperation(input.journal, input.statement);
    if (!operation || (operation === "edit" && !input.canUpdate)) {
      return Promise.reject(new Error(translateCurrent("accounting.dailyIncome.editBlocked.restricted")));
    }
    if (operation === "edit") {
      const promise = update.mutateAsync({ id: input.journal.id, statement: input.statement, values: input.values, options: { ...input.options, expectedVersion: input.journal.version } });
      active.current = promise;
      void promise.then(() => { active.current = null; }, () => { active.current = null; });
      return promise;
    }
    correction.reset();
    const promise = new Promise<DailyIncomeJournal | null>(resolve => setPending({ input, resolve }));
    active.current = promise;
    void promise.finally(() => { active.current = null; });
    return promise;
  }
  function cancel() {
    if (correction.isPending) return;
    pending?.resolve(null);
    setPending(null);
  }
  async function confirm(reason: string) {
    if (!pending || confirming.current) return;
    confirming.current = true;
    try {
      const journal = await correction.mutateAsync({ input: pending.input, reason: reason.trim() });
      pending.resolve(journal);
      setPending(null);
    } catch { /* The mutation exposes the error; retain the draft for an explicit retry. */ }
    finally { confirming.current = false; }
  }
  return { save, pending, cancel, confirm, error: correction.error, isConfirming: correction.isPending, isPending: Boolean(pending) || update.isPending };
}
