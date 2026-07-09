"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

import { AddTransactionWizard } from "@/components/accounting/add-transaction-wizard";
import { FormTabShell } from "@/components/forms/form-tab-shell";
import { useFeedback } from "@/components/app-shell/feedback-provider";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import {
  useAccountingPaymentMethods,
  useChartAccounts,
  useCreateDailyIncomeJournal,
  useDailyIncomeJournal,
  useIncomeStatementById,
  useUpdateDailyIncomeJournal,
} from "@/lib/accounting/daily-income/hooks";
import { journalToFormValues, transactionTypeLabel } from "@/lib/accounting/daily-income/journal-form";
import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { useInvoices } from "@/lib/invoices/hooks/use-invoices";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";
import { useTranslation } from "@/lib/i18n";

export function DailyIncomeTransactionFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const { t } = useTranslation();
  const isEditing = mode === "edit";
  const { notifySuccess } = useFeedback();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();
  const [formError, setFormError] = useState<string | null>(null);

  const journalQuery = useDailyIncomeJournal(isEditing ? (entityId ?? null) : null);
  const addStatementId = !isEditing && entityId ? Number(entityId) : 0;
  const editStatementId = journalQuery.data?.incomeStatementId ?? 0;
  const statementId = isEditing ? editStatementId : addStatementId;
  const statementQuery = useIncomeStatementById(statementId > 0 ? statementId : null);

  const employeesQuery = useEmployees({ page: 1, limit: 200, sort: "name:asc" });
  const employees = useMemo(
    () => (employeesQuery.data?.items ?? []).filter((employee) => employee.active),
    [employeesQuery.data?.items],
  );
  const invoicesQuery = useInvoices({ page: 1, limit: 200, sort: "number:desc" });
  const accountsQuery = useChartAccounts({ page: 1, limit: 500 }, true);
  const bankAccountsQuery = useChartAccounts({ page: 1, limit: 500, type: "BANK" }, true);
  const paymentMethodsQuery = useAccountingPaymentMethods(true);
  const createJournal = useCreateDailyIncomeJournal();
  const updateJournal = useUpdateDailyIncomeJournal();

  const statement = statementQuery.data ?? null;
  const editingJournal = journalQuery.data ?? null;
  const initialValues = isEditing && editingJournal ? journalToFormValues(editingJournal) : undefined;
  const typeLabel = initialValues ? transactionTypeLabel(initialValues.transactionType, t) : null;
  const isSubmitting = createJournal.isPending || updateJournal.isPending;

  useEffect(() => {
    if (isEditing && typeLabel) {
      updateTabLabel(tabId, t("accounting.dailyIncome.tabs.editType", { type: typeLabel }));
    }
  }, [isEditing, tabId, t, typeLabel, updateTabLabel]);

  async function saveJournal(values: DailyIncomeJournalValues): Promise<void> {
    if (!statement) return Promise.reject(new Error(t("accounting.dailyIncome.errors.noCloseoutLoaded")));
    setFormError(null);

    try {
      if (isEditing && editingJournal) {
        await updateJournal.mutateAsync({ id: editingJournal.id, statement, values });
        notifySuccess(t("accounting.dailyIncome.toasts.transactionUpdated"));
        closeFormTabAndReturn(tabId);
        return;
      }

      await createJournal.mutateAsync({ statement, values });

      if (values.transactionType === "INITIAL-PAYMENT") {
        const invoiceNumber = values.invoiceNumber?.trim() || "invoice";
        notifySuccess(t("accounting.dailyIncome.toasts.invoiceRegistered", { invoiceNumber }));
        return;
      }

      notifySuccess(t("accounting.dailyIncome.toasts.transactionCreated"));
    } catch (error) {
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

  if (!isEditing && statementQuery.isLoading) {
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
    const message = statementQuery.isError
      ? normalizeApiError(statementQuery.error).message
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

  return (
    <FormTabShell
      title={isEditing ? t("accounting.dailyIncome.wizard.editTitle") : t("accounting.dailyIncome.wizard.addTitle")}
      description={description}
      className="max-w-3xl"
    >
      {isEditing && initialValues ? (
        <AddTransactionWizard
          presentation="tab"
          open
          mode="edit"
          initialValues={initialValues}
          employees={employees}
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
          employees={employees}
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
}
