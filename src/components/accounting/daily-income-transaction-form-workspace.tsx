"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { SessionTransactionsLayout } from "@/components/accounting/session-transactions-panel";
import { AddTransactionWizard } from "@/components/accounting/add-transaction-wizard";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { isDuplicatePaymentWarning, type JournalWriteOptions } from "@/lib/accounting/daily-income/duplicate-payment";
import { normalizeApiError } from "@/lib/api/axios";
import {
  useAccountingPaymentMethods,
  useSessionDailyIncomeTransactions,
  useChartAccounts,
  useCreateDailyIncomeJournal,
  useDailyIncomeJournal,
  useIncomeStatementById,
  useCurrentIncomeStatement,
  useUpdateDailyIncomeJournal,
} from "@/lib/accounting/daily-income/hooks";
import { journalToFormValues, areDailyIncomeJournalValuesEquivalent, journalCreatedToastMessage, transactionTypeLabel } from "@/lib/accounting/daily-income/journal-form";
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
  const { t } = useTranslation();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  if (props.mode === "edit") {
    return <FormTabShell title={t("accounting.dailyIncome.wizard.editTitle")}>
      <p className="p-5">{t("accounting.financialActivity.postedImmutable")}</p>
      <Button variant="outline" onClick={() => closeFormTabAndReturn(props.tabId)}>{t("common.actions.close")}</Button>
    </FormTabShell>;
  }
  return <DailyIncomeTransactionEntry {...props} />;
}

function DailyIncomeTransactionEntry({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const isEditing = mode === "edit";
  const transactionSessionId = useId();
  const [entryActive, setEntryActive] = useState(false);
  const { notifySuccess } = useFeedback();
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
  // Payments and discounts apply only to invoices with an outstanding balance. The API
  // search allowlist has no `balance` field, so filter by paidStatus != CLOSED (OPEN or PARTIAL).
  const invoicesQuery = useInvoices({
    page: 1,
    limit: 200,
    sort: "number:desc",
    filterRows: [{ id: "payment-outstanding", join: "and", field: "paidStatus", operator: "neq", value: "CLOSED" }],
  });
  const accountsQuery = useChartAccounts({ page: 1, limit: 500 }, true);
  const bankAccountsQuery = useChartAccounts({ page: 1, limit: 500, type: "BANK" }, true);
  const paymentMethodsQuery = useAccountingPaymentMethods(true);
  const createJournal = useCreateDailyIncomeJournal(transactionSessionId);
  const updateJournal = useUpdateDailyIncomeJournal();

  const statement = currentStatementQuery.data ?? null;
  const editingJournal = journalQuery.data ?? null;
  const initialValues = useMemo(
    () => (isEditing && editingJournal ? journalToFormValues(editingJournal) : undefined),
    [editingJournal, isEditing],
  );
  const typeLabel = initialValues ? transactionTypeLabel(initialValues.transactionType, t) : null;
  const isSubmitting = createJournal.isPending || updateJournal.isPending;

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

        await updateJournal.mutateAsync({ id: editingJournal.id, statement, values, options });
        notifySuccess(t("accounting.dailyIncome.toasts.transactionUpdated"));
        closeFormTabAndReturn(tabId);
        return;
      }

      const journal = await createJournal.mutateAsync({ statement, values, options });
      if (journal?.incomeStatementId) setRecordingStatementId(journal.incomeStatementId);
      notifySuccess(journalCreatedToastMessage({ ...values, invoiceNumber: journal?.invoice?.number || values.invoiceNumber }, t));
    } catch (error) {
      if (isDuplicatePaymentWarning(error) && !options?.allowDuplicatePayment) throw error;
      const message = normalizeApiError(error).message;
      setFormError(message);
      return Promise.reject(error);
    }
  }

  if (isEditing && journalQuery.isLoading) {
    return (
      <FormTabShell title={t("accounting.dailyIncome.wizard.editTitle")}>
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("accounting.dailyIncome.loading.transaction")}
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (journalQuery.isError || !editingJournal)) {
    const message = journalQuery.isError
      ? normalizeApiError(journalQuery.error).message
      : t("accounting.dailyIncome.errors.transactionNotFound");
    return (
      <FormTabShell title={t("accounting.dailyIncome.wizard.editTitle")}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <p className="text-sm text-destructive">{message}</p>
          <Button variant="outline" onClick={() => closeFormTabAndReturn(tabId)}>
            {t("common.actions.close")}
          </Button>
        </div>
      </FormTabShell>
    );
  }

  if (!isEditing && (statementQuery.isLoading || currentStatementQuery.isLoading)) {
    return (
      <FormTabShell title={t("accounting.dailyIncome.wizard.addTitle")}>
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("accounting.dailyIncome.loading.closeout")}
        </div>
      </FormTabShell>
    );
  }

  if (!statement) {
    const message = statementQuery.isError || currentStatementQuery.isError
      ? normalizeApiError(statementQuery.error ?? currentStatementQuery.error).message
      : t("accounting.dailyIncome.errors.closeoutNotFound");
    return (
      <FormTabShell title={isEditing ? t("accounting.dailyIncome.wizard.editTitle") : t("accounting.dailyIncome.wizard.addTitle")}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <p className="text-sm text-destructive">{message}</p>
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
      title={isEditing ? t("accounting.dailyIncome.wizard.editTitle") : t("accounting.dailyIncome.wizard.addTitle")}
      description={description}
      className="min-w-0 max-w-5xl"
    >
      {isEditing && initialValues ? (
        <AddTransactionWizard
          presentation="tab"
          open
          mode="edit"
          initialValues={initialValues}
          employees={employees}
          dailyRoutes={dailyRoutes}
          statementDate={statement.date}
          statementBranchId={statement.branch?.id}
          accounts={accountsQuery.data?.items ?? []}
          bankAccounts={bankAccountsQuery.data?.items ?? []}
          invoices={invoicesQuery.data?.items ?? []}
          paymentMethods={paymentMethodsQuery.data ?? []}
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
          onEntryActiveChange={setEntryActive}
          employees={employees}
          dailyRoutes={dailyRoutes}
          statementDate={statement.date}
          statementBranchId={statement.branch?.id}
          accounts={accountsQuery.data?.items ?? []}
          bankAccounts={bankAccountsQuery.data?.items ?? []}
          invoices={invoicesQuery.data?.items ?? []}
          paymentMethods={paymentMethodsQuery.data ?? []}
          isSubmitting={isSubmitting}
          error={formError}
          onSubmit={saveJournal}
          onCancel={() => closeFormTabAndReturn(tabId)}
        />
      )}
    </FormTabShell>
  );
  return isEditing ? wizard : <SessionTransactionsLayout active={entryActive} entries={sessionTransactions} currency={statement.currency}>{wizard}</SessionTransactionsLayout>;
}
