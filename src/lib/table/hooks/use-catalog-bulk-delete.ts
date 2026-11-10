"use client";

import { useState } from "react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { reportBulkSettled } from "@/lib/api/report-bulk-settled";
import { runSettledWithConcurrency } from "@/lib/api/run-settled-with-concurrency";
import { useTranslation } from "@/lib/i18n";

type UseCatalogBulkDeleteOptions<T> = {
  getId: (row: T) => string;
  /** Deletes one record without prompting; confirmation is owned by the dialog. */
  deleteOne: (row: T) => Promise<unknown>;
  entityLabel: string;
  /** Called with the ids that were deleted (e.g. to drop them from the selection). */
  onDeleted?: (ids: string[]) => void;
};

/** One confirmation, then a settled batch delete for rows selected in a catalog table. */
export function useCatalogBulkDelete<T>({ getId, deleteOne, entityLabel, onDeleted }: UseCatalogBulkDeleteOptions<T>) {
  const { t } = useTranslation();
  const { notifyDeleted, notifyError } = useFeedback();
  const [targets, setTargets] = useState<T[] | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!targets?.length || isPending) return;
    setIsPending(true);
    setError(null);
    try {
      const result = await runSettledWithConcurrency(targets, {
        getId,
        run: async (row) => {
          await deleteOne(row);
        },
      });
      reportBulkSettled({
        result,
        t,
        entityLabel,
        notifyDeleted,
        notifyError,
        onAllFailed: setError,
        onDone: () => {
          onDeleted?.(result.succeededIds);
          setTargets(null);
        },
      });
    } finally {
      setIsPending(false);
    }
  }

  return {
    targets,
    isPending,
    error,
    request: (rows: T[]) => {
      setError(null);
      setTargets(rows.length ? rows : null);
    },
    cancel: () => {
      if (!isPending) setTargets(null);
    },
    confirm,
  };
}

export type CatalogBulkDeleteState<T> = ReturnType<typeof useCatalogBulkDelete<T>>;
