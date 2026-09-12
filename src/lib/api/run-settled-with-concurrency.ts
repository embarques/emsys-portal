import { normalizeApiError } from "@/lib/api/api-error";

export const DEFAULT_BULK_CONCURRENCY = 6;

export type BulkSettledResult<TId> = {
  succeededIds: TId[];
  failedIds: TId[];
  firstErrorMessage?: string;
};

export type RunSettledWithConcurrencyOptions<TItem, TId> = {
  /** Max in-flight operations. Defaults to {@link DEFAULT_BULK_CONCURRENCY}. */
  concurrency?: number;
  getId: (item: TItem) => TId;
  run: (item: TItem) => Promise<void>;
  /** Treat certain errors as success (e.g. 404 already deleted). */
  treatAsSuccess?: (error: unknown, item: TItem) => boolean;
};

/**
 * Run async work over many items with a concurrency limit.
 * Settles every item — failures do not stop the rest of the batch.
 */
export async function runSettledWithConcurrency<TItem, TId>(
  items: TItem[],
  options: RunSettledWithConcurrencyOptions<TItem, TId>,
): Promise<BulkSettledResult<TId>> {
  const concurrency = Math.max(1, options.concurrency ?? DEFAULT_BULK_CONCURRENCY);
  const succeededIds: TId[] = [];
  const failedIds: TId[] = [];
  let firstErrorMessage: string | undefined;

  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item === undefined) continue;

      const id = options.getId(item);
      try {
        await options.run(item);
        succeededIds.push(id);
      } catch (error) {
        if (options.treatAsSuccess?.(error, item)) {
          succeededIds.push(id);
          continue;
        }
        failedIds.push(id);
        if (!firstErrorMessage) {
          firstErrorMessage = normalizeApiError(error).message;
        }
      }
    }
  }

  const workerCount = Math.min(concurrency, Math.max(items.length, 0));
  if (workerCount === 0) {
    return { succeededIds, failedIds, firstErrorMessage };
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return { succeededIds, failedIds, firstErrorMessage };
}

/** Convenience wrapper when each item is already an id. */
export async function runSettledIdsWithConcurrency<TId>(
  ids: TId[],
  run: (id: TId) => Promise<void>,
  options?: Omit<RunSettledWithConcurrencyOptions<TId, TId>, "getId" | "run"> & {
    treatAsSuccess?: (error: unknown, id: TId) => boolean;
  },
): Promise<BulkSettledResult<TId>> {
  return runSettledWithConcurrency(ids, {
    concurrency: options?.concurrency,
    getId: (id) => id,
    run,
    treatAsSuccess: options?.treatAsSuccess,
  });
}
