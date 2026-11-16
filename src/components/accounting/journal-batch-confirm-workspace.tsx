"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

import { ClearanceConfirmList, JournalTotals } from "@/components/accounting/journal-totals";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { FormTabShell } from "@/components/forms/form-tab-shell";
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
  const text = (key: string) => t(`accounting.${clearance ? "journalClearance" : "journalReconciliation"}.${key}`);
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
      <FormTabShell title={text("confirmTitle")} className={clearance ? "max-w-4xl" : "max-w-6xl"}>
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
      <FormTabShell title={text("confirmTitle")} className={clearance ? "max-w-4xl" : "max-w-6xl"}>
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
      className={clearance ? "max-w-4xl" : "max-w-6xl"}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-5">
        <p>
          {text("selectedCount")} {ids.length}
        </p>
        {clearance ? <ClearanceConfirmList rows={rows} chartAccountsById={chartAccountsById} /> : null}
        {selectedTotals.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {normalizeApiError(selectedTotals.error).message}
          </p>
        ) : (
          <JournalTotals
            label={text("selectedTotals")}
            totals={selectedTotals.data}
            journals={rows}
            chartAccounts={chartAccountsQuery.data?.items ?? []}
            loading={selectedTotals.isFetching}
            showTransactions={!clearance}
          />
        )}
        {processMutation.isError ? (
          <p role="alert" className="text-destructive">
            {normalizeApiError(processMutation.error).message}
          </p>
        ) : null}
        {outcome ? (
          <div role="status" className="max-h-64 space-y-2 overflow-y-auto text-sm">
            <p>{text(outcome.complete ? "batchComplete" : "batchUnconfirmed")}</p>
            {outcome.confirmed.map((id) => (
              <p key={id}>
                {id} — {text("confirmed")}
              </p>
            ))}
            {outcome.unconfirmed.map((id) => (
              <p key={id}>
                {id} — {text("unconfirmed")}
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t px-5 py-4">
        <Button type="button" variant="outline" disabled={processMutation.isPending} onClick={closeConfirm}>
          {t("common.actions.cancel")}
        </Button>
        <Button
          type="button"
          disabled={!ready || processMutation.isPending || Boolean(outcome?.complete)}
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
      </div>
    </FormTabShell>
  );
}
