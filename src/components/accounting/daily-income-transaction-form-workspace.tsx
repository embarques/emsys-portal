"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";

import { SessionTransactionsLayout } from "@/components/accounting/session-transactions-panel";
import { AddTransactionWizard } from "@/components/accounting/add-transaction-wizard";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { isDuplicatePaymentWarning, type JournalWriteOptions } from "@/lib/accounting/daily-income/duplicate-payment";
import { normalizeDailyIncomeJournalError } from "@/lib/accounting/daily-income/journal-api-error";
import { canOpenEmployeesDirectory } from "@/components/accounting/open-employees-recovery-action";
import { formatFormMutationError, useUserError } from "@/lib/errors";
import {
  useAccountingPaymentMethods,
  useSessionDailyIncomeTransactions,
  useChartAccounts,
  useCreateDailyIncomeJournal,
  useDailyIncomeJournal,
  useIncomeStatementById,
  useCurrentIncomeStatement,
} from "@/lib/accounting/daily-income/hooks";
import { journalToFormValues, areDailyIncomeJournalValuesEquivalent, journalCreatedToastMessage, transactionTypeLabel } from "@/lib/accounting/daily-income/journal-form";
import { JournalCorrectionDialog } from "./journal-correction-dialog";
import { useJournalEdit } from "@/lib/accounting/daily-income/use-journal-edit";
import { journalEditOperation, journalEditBlockReason } from "@/lib/accounting/daily-income/journal-editability";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { useInvoices } from "@/lib/invoices/hooks/use-invoices";
import { useDailyRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";
import { useTranslation } from "@/lib/i18n";

export function DailyIncomeTransactionFormWorkspace(props: WorkspaceFormHostProps) {
  return <DailyIncomeTransactionEntry {...props} />;
}

function DailyIncomeTransactionEntry({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const { toErrorMessage } = useUserError();
  const isEditing = mode === "edit";
  const transactionSessionId = useId();
  const [summaryContainer, setSummaryContainer] = useState<HTMLDivElement | null>(null);
  const [entryActive, setEntryActive] = useState(false);
  const { notifySuccess, notifyError } = useFeedback();
  const { hasPermission } = useAuth();
  const canUpdateJournals = hasPermission(PERMISSIONS.journalsUpdate.name, PERMISSIONS.journalsUpdate.resourceType);
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();
  const [formError, setFormError] = useState<string | null>(null);

  const journalQuery = useDailyIncomeJournal(isEditing ? (entityId ?? null) : null);
  const addStatementId = !isEditing && entityId ? Number(entityId) : 0;
  const editStatementId = journalQuery.data?.incomeStatementId ?? 0;
  const [recordingStatementId, setRecordingStatementId] = useState(0);
  const statementId = isEditing ? editStatementId : recordingStatementId || addStatementId;
  const statementQuery = useIncomeStatementById(statementId > 0 ? statementId : null);
  const currentStatementQuery = useCurrentIncomeStatement(statementQuery.data?.branch?.id ?? 0);
  const sessionTransactions = useSessionDailyIncomeTransactions(currentStatementQuery.data?.id ?? statementId, transactionSessionId);

  const employeesQuery = useEmployees({ page: 1, limit: 200, sort: "name:asc" });
  const employees = useMemo(
    () => (employeesQuery.data?.items ?? []).filter((employee) => employee.active),
    [employeesQuery.data?.items],
  );
  const dailyRoutesQuery = useDailyRoutePicker(200);
  const dailyRoutes = dailyRoutesQuery.data?.items ?? [];
  // Payment entry can search any invoice (paid or unpaid); the form blocks paid-off invoices.
  const invoicesQuery = useInvoices({
    page: 1,
    limit: 200,
    sort: "number:desc",
  });
  const accountsQuery = useChartAccounts({ page: 1, limit: 500 }, true);
  const bankAccountsQuery = useChartAccounts({ page: 1, limit: 500, type: "BANK" }, true);
  const paymentMethodsQuery = useAccountingPaymentMethods(true);
  const entryLookups = [employeesQuery, dailyRoutesQuery, invoicesQuery, accountsQuery, bankAccountsQuery, paymentMethodsQuery];
  const lookupLoading = entryLookups.some((query) => query.isLoading);
  const failedLookups = entryLookups.filter((query) => query.isError);
  const lookupError = failedLookups.length ? toErrorMessage(failedLookups[0].error) : null;
  const retryLookups = () => { for (const query of failedLookups) void query.refetch(); };

  const createJournal = useCreateDailyIncomeJournal(transactionSessionId);
  const editWorkflow = useJournalEdit();

  const statement = currentStatementQuery.data ?? null;
  const editingJournal = journalQuery.data ?? null;
  const initialValues = useMemo(
    () => (isEditing && editingJournal ? journalToFormValues(editingJournal) : undefined),
    [editingJournal, isEditing],
  );
  const typeLabel = initialValues ? transactionTypeLabel(initialValues.transactionType, t) : null;
  const isSubmitting = createJournal.isPending || editWorkflow.isPending;

  useEffect(() => {
    if (isEditing && typeLabel) {
      updateTabLabel(tabId, t("accounting.dailyIncome.tabs.editType", { type: typeLabel }));
    }
  }, [isEditing, tabId, t, typeLabel, updateTabLabel]);

  async function saveJournal(values: DailyIncomeJournalValues, options?: JournalWriteOptions): Promise<void> {
    if (!statement) return Promise.reject(new Error(t("accounting.dailyIncome.errors.noCloseoutLoaded")));
    setFormError(null);

    try {
      if (isEditing && editingJournal) {
        if (areDailyIncomeJournalValuesEquivalent(values, journalToFormValues(editingJournal))) {
          notifySuccess(t("common.form.noChanges"));
          closeFormTabAndReturn(tabId);
          return;
        }

        const saved = await editWorkflow.save({ journal: editingJournal, statement, values, options, canUpdate: canUpdateJournals });
        if (!saved) return;
        notifySuccess(t("accounting.dailyIncome.toasts.transactionUpdated"));
        closeFormTabAndReturn(tabId);
        return;
      }

      const journal = await createJournal.mutateAsync({ statement, values, options });
      if (journal?.incomeStatementId) setRecordingStatementId(journal.incomeStatementId);
      if (values.clearPaymentOnSave && journal?.clearanceStatus !== "CLEARED") {
        notifyError(t("accounting.dailyIncome.toasts.paymentSavedClearanceUnconfirmed"));
      } else if (values.clearPaymentOnSave && journal?.reconciliationStatus === "OUTSTANDING") {
        notifyError(t("accounting.dailyIncome.toasts.paymentClearedReconciliationPending"));
      } else {
        notifySuccess(journalCreatedToastMessage({ ...values, invoiceNumber: journal?.invoice?.number || values.invoiceNumber }, t));
      }
    } catch (error) {
      if (isDuplicatePaymentWarning(error) && !options?.allowDuplicatePayment) throw error;
      setFormError(
        formatFormMutationError(error, t, {
          formatConflict: (mutationError) =>
            normalizeDailyIncomeJournalError(mutationError, {
              canManageEmployees: canOpenEmployeesDirectory(hasPermission),
            }),
        }),
      );
      return Promise.reject(error);
    }
  }

  if (isEditing && journalQuery.isLoading) {
    return (
      <FormTabShell title={t("accounting.dailyIncome.wizard.editTitle")}>
        <div role="status" className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("accounting.dailyIncome.loading.transaction")}
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (journalQuery.isError || !editingJournal)) {
    const message = journalQuery.isError
      ? toErrorMessage(journalQuery.error)
      : t("accounting.dailyIncome.errors.transactionNotFound");
    return (
      <FormTabShell title={t("accounting.dailyIncome.wizard.editTitle")}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <p role="alert" className="text-sm text-destructive">{message}</p>
          {journalQuery.isError ? <Button variant="outline" disabled={journalQuery.isFetching} onClick={() => void journalQuery.refetch()}>{t("common.actions.retry")}</Button> : null}
          <Button variant="outline" onClick={() => closeFormTabAndReturn(tabId)}>
            {t("common.actions.close")}
          </Button>
        </div>
      </FormTabShell>
    );
  }

  if (statementQuery.isLoading || currentStatementQuery.isLoading) {
    return (
      <FormTabShell title={isEditing ? t("accounting.dailyIncome.wizard.editTitle") : t("accounting.dailyIncome.wizard.addTitle")}>
        <div role="status" className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("accounting.dailyIncome.loading.closeout")}
        </div>
      </FormTabShell>
    );
  }

  if (!statement) {
    const message = statementQuery.isError || currentStatementQuery.isError
      ? toErrorMessage(statementQuery.error ?? currentStatementQuery.error)
      : t("accounting.dailyIncome.errors.closeoutNotFound");
    return (
      <FormTabShell title={isEditing ? t("accounting.dailyIncome.wizard.editTitle") : t("accounting.dailyIncome.wizard.addTitle")}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <p role="alert" className="text-sm text-destructive">{message}</p>
          {statementQuery.isError || currentStatementQuery.isError ? <Button variant="outline" disabled={statementQuery.isFetching || currentStatementQuery.isFetching} onClick={() => {
            if (statementQuery.isError) void statementQuery.refetch();
            if (currentStatementQuery.isError) void currentStatementQuery.refetch();
          }}>{t("common.actions.retry")}</Button> : null}
          <Button variant="outline" onClick={() => closeFormTabAndReturn(tabId)}>
            {t("common.actions.close")}
          </Button>
        </div>
      </FormTabShell>
    );
  }

  const editOperation = editingJournal ? journalEditOperation(editingJournal, statement) : null;
  const canEdit = editOperation === "correct" || (editOperation === "edit" && canUpdateJournals);
  const editBlock = isEditing && editingJournal && !canEdit
    ? journalEditBlockReason(editingJournal, statement) ?? "permission"
    : null;
  if (editBlock) {
    return (
      <FormTabShell title={t("accounting.dailyIncome.wizard.editTitle")}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <p className="text-sm text-muted-foreground">{t(`accounting.dailyIncome.editBlocked.${editBlock}`)}</p>
          <Button variant="outline" onClick={() => closeFormTabAndReturn(tabId)}>
            {t("common.actions.close")}
          </Button>
        </div>
      </FormTabShell>
    );
  }

  const closeoutLabel = t("accounting.dailyIncome.tabs.closeoutLabel", {
    id: String(statement.id).padStart(5, "0"),
    date: statement.date,
  });
  const description = isEditing && typeLabel
    ? `${typeLabel} · ${closeoutLabel}`
    : closeoutLabel;

  const wizard = (
    <FormTabShell
      compactHeader
      title={isEditing ? t("accounting.dailyIncome.wizard.editTitle") : t("accounting.dailyIncome.wizard.addTitle")}
      description={description}
      actions={!isEditing && !entryActive ? (
        <Button type="button" variant="ghost" size="icon" aria-label={t("common.actions.close")} disabled={isSubmitting} onClick={() => closeFormTabAndReturn(tabId)}>
          <X className="size-4" />
        </Button>
      ) : undefined}
      className="min-w-0 max-w-5xl"
    >
      {isEditing && initialValues ? (
        <AddTransactionWizard
          presentation="tab"
          open
          mode="edit"
          initialValues={initialValues}
          paymentClearanceStatus={editingJournal?.clearanceStatus}
          employees={employees}
          dailyRoutes={dailyRoutes}
          statementDate={statement.date}
          statementBranchId={statement.branch?.id}
          accounts={accountsQuery.data?.items ?? []}
          bankAccounts={bankAccountsQuery.data?.items ?? []}
          invoices={invoicesQuery.data?.items ?? []}
          paymentMethods={paymentMethodsQuery.data ?? []}
          lookupLoading={lookupLoading}
          lookupError={lookupError}
          onRetryLookups={retryLookups}
          isSubmitting={isSubmitting}
          error={formError}
          onSubmit={saveJournal}
          onCancel={() => closeFormTabAndReturn(tabId)}
        />
      ) : (
        <AddTransactionWizard
          presentation="tab"
          open
          mode="add"
          summaryContainer={summaryContainer}
          summaryCurrency={statement.currency}
          onEntryActiveChange={setEntryActive}
          employees={employees}
          dailyRoutes={dailyRoutes}
          statementDate={statement.date}
          statementBranchId={statement.branch?.id}
          accounts={accountsQuery.data?.items ?? []}
          bankAccounts={bankAccountsQuery.data?.items ?? []}
          invoices={invoicesQuery.data?.items ?? []}
          paymentMethods={paymentMethodsQuery.data ?? []}
          lookupLoading={lookupLoading}
          lookupError={lookupError}
          onRetryLookups={retryLookups}
          isSubmitting={isSubmitting}
          error={formError}
          onSubmit={saveJournal}
          onCancel={() => closeFormTabAndReturn(tabId)}
        />
      )}
    </FormTabShell>
  );
  return <><JournalCorrectionDialog workflow={editWorkflow} />{isEditing ? wizard : <SessionTransactionsLayout summaryRef={setSummaryContainer} entries={sessionTransactions} currency={statement.currency}>{wizard}</SessionTransactionsLayout>}</>;
}
