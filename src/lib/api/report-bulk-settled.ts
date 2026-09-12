import type { BulkSettledResult } from "@/lib/api/run-settled-with-concurrency";

type Translate = (key: string, values?: Record<string, string | number>) => string;

export type ReportBulkSettledParams<TId> = {
  result: BulkSettledResult<TId>;
  /** Total attempted (defaults to succeeded + failed). */
  total?: number;
  t: Translate;
  notifyDeleted?: (entityLabel: string, count?: number) => void;
  notifySuccess?: (message: string) => void;
  notifyError: (message: string) => void;
  entityLabel?: string;
  /** Override success toast when all/some succeeded (e.g. mark complete). */
  onSucceeded?: (succeededCount: number) => void;
  /** Called when every item failed — keep dialog open / show inline error. */
  onAllFailed: (message: string) => void;
  /** Called when at least one item succeeded (close dialog, clear view, etc.). */
  onDone: () => void;
};

/**
 * Standardize bulk mutation UX:
 * - all failed → onAllFailed (no success toast)
 * - some/all succeeded → onDone + success toast(s) + optional partial error toast
 */
export function reportBulkSettled<TId>(params: ReportBulkSettledParams<TId>): void {
  const {
    result,
    t,
    notifyDeleted,
    notifySuccess,
    notifyError,
    entityLabel,
    onSucceeded,
    onAllFailed,
    onDone,
  } = params;

  const succeededCount = result.succeededIds.length;
  const failedCount = result.failedIds.length;
  const total = params.total ?? succeededCount + failedCount;

  if (succeededCount === 0) {
    onAllFailed(result.firstErrorMessage?.trim() || t("common.errors.fallback"));
    return;
  }

  onDone();

  if (onSucceeded) {
    onSucceeded(succeededCount);
  } else if (notifyDeleted && entityLabel) {
    notifyDeleted(entityLabel, succeededCount);
  } else if (notifySuccess) {
    notifySuccess(t("common.toasts.updated", { entity: entityLabel ?? "" }));
  }

  if (failedCount > 0) {
    const message =
      result.firstErrorMessage?.trim() || t("common.errors.fallback");
    notifyError(
      t("common.toasts.bulkPartialFailure", {
        failed: failedCount,
        total,
        message,
      }),
    );
  }
}
