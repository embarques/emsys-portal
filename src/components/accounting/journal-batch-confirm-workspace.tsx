"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { ClearanceConfirmList, JournalTotals } from "@/components/accounting/journal-totals";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useChartAccounts } from "@/lib/accounting/chart-accounts/hooks/use-chart-accounts";
import { atomicBatchOutcome } from "@/lib/accounting/daily-income/batch-outcome";
import { buildChartAccountsById } from "@/lib/accounting/daily-income/journal-account";
import {
  clearJournalBatch,
  publishJournalBatchConfirmed,
  readJournalBatch,
  type JournalBatchQueue,
} from "@/lib/accounting/daily-income/journal-batch-draft";
import {
  useClearJournals,
  useJournalSummary,
  useReconcileJournals,
} from "@/lib/accounting/daily-income/reconciliation";
import { useTranslation } from "@/lib/i18n";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";
import { useWorkspaceTabs } from "@/lib/layout/hooks/use-workspace-tabs";
import { cn } from "@/lib/utils";

type JournalBatchConfirmWorkspaceProps = WorkspaceFormHostProps & {
  queue?: JournalBatchQueue;
};

export function JournalReconciliationBatchWorkspace(props: WorkspaceFormHostProps) {
  return <JournalBatchConfirmWorkspace {...props} queue="reconciliation" />;
}

export function JournalClearanceBatchWorkspace(props: WorkspaceFormHostProps) {
  return <JournalBatchConfirmWorkspace {...props} queue="clearance" />;
}

/** Mobile/full-page confirm route host (no workspace form tab props). */
export function JournalBatchConfirmPage({ queue }: { queue: JournalBatchQueue }) {
  const searchParams = useSearchParams();
  const requestId = searchParams.get("requestId") ?? undefined;
  return <JournalBatchConfirmWorkspace tabId="" mode="stage" entityId={requestId} queue={queue} />;
}

function JournalBatchConfirmWorkspace({
  tabId,
  entityId,
  queue: queueProp,
  journalBatch,
}: JournalBatchConfirmWorkspaceProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { notifySuccess } = useFeedback();
  const { hasPermission } = useAuth();
  const { closeFormTabAndReturn, isDesktopTabs } = useWorkspaceTabs();
  const draft = useMemo(
    () => readJournalBatch(journalBatch?.requestId ?? entityId),
    [entityId, journalBatch?.requestId],
  );
  const queue = queueProp ?? journalBatch?.queue ?? draft?.queue ?? "reconciliation";
  const clearance = queue === "clearance";
  const text = (key: string, values?: Record<string, string | number>) =>
    t(`accounting.${clearance ? "journalClearance" : "journalReconciliation"}.${key}`, values);
  const actionLabel = text(clearance ? "clearSelected" : "reconcileSelected");
  const baseHref = clearance ? "/accounting/pending-clearance" : "/accounting/pending-financial-activity";
  const ids = journalBatch?.ids ?? draft?.ids ?? [];
  const rows = draft?.rows ?? [];
  const requestId = journalBatch?.requestId ?? entityId ?? draft?.requestId ?? "";
  const canProcess = hasPermission(clearance ? "canClearJournal" : "canReconcileJournal", "journal");
  const selectedTotals = useJournalSummary({ ids }, ids.length > 0);
  const reconciliationMutation = useReconcileJournals();
  const clearanceMutation = useClearJournals();
  const processMutation = clearance ? clearanceMutation : reconciliationMutation;
  const [outcome, setOutcome] = useState<ReturnType<typeof atomicBatchOutcome> | null>(null);
  const chartAccountsQuery = useChartAccounts(
    { page: 1, limit: 500 },
    hasPermission("canViewChartAccount", "chart_account"),
  );
  const chartAccountsById = useMemo(
    () => buildChartAccountsById(chartAccountsQuery.data?.items ?? []),
    [chartAccountsQuery.data],
  );

  useEffect(() => {
    return () => {
      if (outcome?.complete) clearJournalBatch(requestId);
    };
  }, [outcome?.complete, requestId]);

  function closeConfirm() {
    clearJournalBatch(requestId);
    if (isDesktopTabs && tabId) {
      closeFormTabAndReturn(tabId);
      return;
    }
    router.replace(baseHref);
  }

  if (!requestId || ids.length === 0) {
    return (
      <FormTabShell title={text("confirmTitle")}>
        <div className="flex flex-1 flex-col gap-4 p-5">
          <p role="alert" className="text-sm text-destructive">
            {text("confirmMissingSelection")}
          </p>
          <div className="mt-auto flex justify-end border-t pt-4">
            <Button type="button" variant="outline" onClick={closeConfirm}>
              {t("common.actions.cancel")}
            </Button>
          </div>
        </div>
      </FormTabShell>
    );
  }

  if (!canProcess) {
    return (
      <FormTabShell title={text("confirmTitle")}>
        <div className="flex flex-1 flex-col gap-4 p-5">
          <p role="alert" className="text-sm text-destructive">
            {t("common.errors.forbidden")}
          </p>
          <div className="mt-auto flex justify-end border-t pt-4">
            <Button type="button" variant="outline" onClick={closeConfirm}>
              {t("common.actions.cancel")}
            </Button>
          </div>
        </div>
      </FormTabShell>
    );
  }

  const ready =
    !selectedTotals.isFetching &&
    selectedTotals.isSuccess &&
    ids.length > 0 &&
    !outcome?.complete;

  return (
    <FormTabShell
      title={text("confirmTitle")}
      description={text("confirmDescription")}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-5">
        {clearance ? <ClearanceConfirmList rows={rows} chartAccountsById={chartAccountsById} /> : null}
        {selectedTotals.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {normalizeApiError(selectedTotals.error).message}
          </p>
        ) : (
          <JournalTotals
            label={text("selectedTotalsCount", { count: ids.length })}
            totals={selectedTotals.data}
            journals={rows}
            chartAccounts={chartAccountsQuery.data?.items ?? []}
            loading={selectedTotals.isFetching}
            layout={clearance ? "stacked" : "split"}
            showTransactions={!clearance}
          />
        )}
        {processMutation.isError ? (
          <p role="alert" className="shrink-0 text-destructive">
            {normalizeApiError(processMutation.error).message}
          </p>
        ) : null}
        {outcome ? (
          <div
            role="status"
            aria-live="polite"
            className={cn(
              "shrink-0 rounded-xl border p-4",
              outcome.complete
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"
                : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100",
            )}
          >
            <div className="flex items-start gap-3">
              {outcome.complete ? (
                <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 size-6 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1 space-y-3">
                <div className="space-y-1">
                  <p className="font-medium leading-snug">
                    {text(outcome.complete ? "batchComplete" : "batchUnconfirmed")}
                  </p>
                  <p className="text-sm opacity-90">
                    {text("confirmedCount", { count: outcome.confirmed.length })}
                    {outcome.unconfirmed.length > 0
                      ? ` · ${text("unconfirmedCount", { count: outcome.unconfirmed.length })}`
                      : null}
                  </p>
                </div>
                {outcome.unconfirmed.length > 0 ? (
                  <ul className="max-h-40 space-y-2 overflow-y-auto">
                    {outcome.unconfirmed.map((id) => (
                      <li key={id} className="flex flex-wrap items-center gap-2 text-sm">
                        <code className="truncate rounded bg-background/60 px-1.5 py-0.5 font-mono text-xs">
                          {id}
                        </code>
                        <Badge
                          variant="outline"
                          className="border-amber-300 bg-amber-100/80 font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-900/50 dark:text-amber-100"
                        >
                          {text("unconfirmed")}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t px-5 py-4">
        <Button type="button" variant="outline" disabled={processMutation.isPending} onClick={closeConfirm}>
          {outcome?.complete ? t("common.actions.close") : t("common.actions.cancel")}
        </Button>
        {outcome?.complete ? null : (
          <Button
            type="button"
            disabled={!ready || processMutation.isPending}
            onClick={() => {
              const command = { requestId, ids };
              const onSuccess = (acknowledged: string[] | undefined) => {
                const result = atomicBatchOutcome(command.ids, [
                  ...(outcome?.confirmed ?? []),
                  ...(Array.isArray(acknowledged) ? acknowledged : []),
                ]);
                setOutcome(result);
                publishJournalBatchConfirmed(result.confirmed);
                if (result.complete) notifySuccess(text("batchComplete"));
              };
              if (clearance) {
                clearanceMutation.mutate(
                  {
                    ...command,
                    invoices: rows.flatMap((row) =>
                      row.invoice?.id
                        ? [{ id: String(row.invoice.id), number: row.invoice.number }]
                        : [],
                    ),
                    incomeStatementIds: [
                      ...new Set(rows.map((row) => row.incomeStatementId).filter((id) => id > 0)),
                    ],
                  },
                  { onSuccess: (response) => onSuccess(response?.data?.cleared) },
                );
                return;
              }
              reconciliationMutation.mutate(command, {
                onSuccess: (response) => onSuccess(response?.data?.reconciled),
              });
            }}
          >
            <CheckCircle2 className="size-4" aria-hidden="true" />
            {actionLabel}
          </Button>
        )}
      </div>
    </FormTabShell>
  );
}
