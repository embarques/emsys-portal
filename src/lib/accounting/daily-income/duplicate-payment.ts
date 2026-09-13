import { isAxiosError } from "axios";

import type { DailyIncomeJournalValues } from "./types";

export type JournalWriteOptions = { allowDuplicatePayment?: boolean };

export type SubmitJournal = (
  values: DailyIncomeJournalValues,
  options?: JournalWriteOptions,
) => void | Promise<void>;

export function journalPaymentFields(
  values: Pick<DailyIncomeJournalValues, "externalReferenceNumber">,
  options: JournalWriteOptions = {},
) {
  return {
    external_reference_number: values.externalReferenceNumber?.trim(),
    ...(options.allowDuplicatePayment === true ? { allowDuplicatePayment: true } : {}),
  };
}

/** Only the verified duplicate warning is eligible for an override, not other 409s. */
export function isDuplicatePaymentWarning(error: unknown): boolean {
  return isAxiosError(error)
    && error.response?.status === 409
    && error.response.data?.message === "Duplicate payment warning";
}

export class DuplicatePaymentCancelledError extends Error {
  constructor() {
    super("Duplicate payment cancelled");
  }
}

export async function submitWithDuplicatePaymentConfirmation(
  values: DailyIncomeJournalValues,
  submit: SubmitJournal,
  confirm: (values: DailyIncomeJournalValues) => Promise<boolean>,
): Promise<void> {
  const snapshot = structuredClone(values);
  try {
    await submit(structuredClone(snapshot));
    return;
  } catch (error) {
    if (!isDuplicatePaymentWarning(error)) throw error;
  }

  if (!await confirm(structuredClone(snapshot))) throw new DuplicatePaymentCancelledError();
  // One explicit retry only. The override is never stored in form values.
  await submit(structuredClone(snapshot), { allowDuplicatePayment: true });
}
