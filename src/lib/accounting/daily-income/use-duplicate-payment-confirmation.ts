"use client";

import { useEffect, useRef, useState } from "react";

import { submitWithDuplicatePaymentConfirmation, type SubmitJournal } from "./duplicate-payment";
import type { DailyIncomeJournalValues } from "./types";

export function useDuplicatePaymentConfirmation(open: boolean) {
  const [pendingValues, setPendingValues] = useState<DailyIncomeJournalValues | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const active = useRef(false);
  const session = useRef(0);
  const available = useRef(open);
  const resolveConfirmation = useRef<((confirmed: boolean) => void) | null>(null);

  useEffect(() => {
    available.current = open;
    return () => {
      available.current = false;
      session.current += 1;
      resolveConfirmation.current?.(false);
      resolveConfirmation.current = null;
    };
  }, [open]);

  function respond(confirmed: boolean) {
    const resolve = resolveConfirmation.current;
    resolveConfirmation.current = null;
    setPendingValues(null);
    resolve?.(confirmed);
  }

  async function submit(values: DailyIncomeJournalValues, action: SubmitJournal) {
    if (active.current || !available.current) return false;
    active.current = true;
    const submittingSession = session.current;
    setIsSubmitting(true);
    try {
      await submitWithDuplicatePaymentConfirmation(values, action, (snapshot) => {
        if (!available.current || submittingSession !== session.current) return Promise.resolve(false);
        setPendingValues(snapshot);
        return new Promise<boolean>((resolve) => { resolveConfirmation.current = resolve; });
      });
      return true;
    } finally {
      active.current = false;
      setIsSubmitting(false);
      setPendingValues(null);
    }
  }

  return { pendingValues, isSubmitting, submit, respond };
}
