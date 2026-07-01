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
import { useEmployeeGroupPicker } from "@/lib/employee-groups/hooks/use-employee-groups";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { useInvoices } from "@/lib/invoices/hooks/use-invoices";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

export function DailyIncomeTransactionFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
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
  const employeeGroupsQuery = useEmployeeGroupPicker(200);
  const employeeGroups = employeeGroupsQuery.data?.items ?? [];
  const invoicesQuery = useInvoices({ page: 1, limit: 200, sort: "number:desc" });
  const accountsQuery = useChartAccounts({ page: 1, limit: 500 }, true);
  const bankAccountsQuery = useChartAccounts({ page: 1, limit: 500, type: "BANK" }, true);
  const paymentMethodsQuery = useAccountingPaymentMethods(true);
  const createJournal = useCreateDailyIncomeJournal();
  const updateJournal = useUpdateDailyIncomeJournal();

  const statement = statementQuery.data ?? null;
  const editingJournal = journalQuery.data ?? null;
  const initialValues = isEditing && editingJournal ? journalToFormValues(editingJournal) : undefined;
  const typeLabel = initialValues ? transactionTypeLabel(initialValues.transactionType) : null;
  const isSubmitting = createJournal.isPending || updateJournal.isPending;

  useEffect(() => {
    if (isEditing && typeLabel) {
      updateTabLabel(tabId, `Edit ${typeLabel}`);
    }
  }, [isEditing, tabId, typeLabel, updateTabLabel]);

  async function saveJournal(values: DailyIncomeJournalValues): Promise<void> {
    if (!statement) return Promise.reject(new Error("No closeout loaded."));
    setFormError(null);

    try {
      if (isEditing && editingJournal) {
        await updateJournal.mutateAsync({ id: editingJournal.id, statement, values });
        notifySuccess("Transaction updated.");
        closeFormTabAndReturn(tabId);
        return;
      }

      await createJournal.mutateAsync({ statement, values });

      if (values.transactionType === "INITIAL-PAYMENT") {
        const invoiceNumber = values.invoiceNumber?.trim() || "invoice";
        notifySuccess(`New invoice #${invoiceNumber} created and payment registered.`);
        return;
      }

      notifySuccess("Transaction created.");
    } catch (error) {
      const message = normalizeApiError(error).message;
      setFormError(message);
      return Promise.reject(error);
    }
  }

  if (isEditing && journalQuery.isLoading) {
    return (
      <FormTabShell title="Edit transaction">
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading transaction…
        </div>
      </FormTabShell>
    );
  }

  if (isEditing && (journalQuery.isError || !editingJournal)) {
    const message = journalQuery.isError
      ? normalizeApiError(journalQuery.error).message
      : "This transaction could not be found.";
    return (
      <FormTabShell title="Edit transaction">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <p className="text-sm text-destructive">{message}</p>
          <Button variant="outline" onClick={() => closeFormTabAndReturn(tabId)}>
            Close
          </Button>
        </div>
      </FormTabShell>
    );
  }

  if (!isEditing && statementQuery.isLoading) {
    return (
      <FormTabShell title="Add transaction">
        <div className="flex flex-1 items-center justify-center gap-2 px-5 py-16 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading closeout…
        </div>
      </FormTabShell>
    );
  }

  if (!statement) {
    const message = statementQuery.isError
      ? normalizeApiError(statementQuery.error).message
      : "This daily closeout could not be found.";
    return (
      <FormTabShell title={isEditing ? "Edit transaction" : "Add transaction"}>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 py-16 text-center">
          <p className="text-sm text-destructive">{message}</p>
          <Button variant="outline" onClick={() => closeFormTabAndReturn(tabId)}>
            Close
          </Button>
        </div>
      </FormTabShell>
    );
  }

  const closeoutLabel = `Closeout #${String(statement.id).padStart(5, "0")} · ${statement.date}`;
  const description = isEditing && typeLabel
    ? `${typeLabel} · ${closeoutLabel}`
    : closeoutLabel;

  return (
    <FormTabShell
      title={isEditing ? "Edit transaction" : "Add transaction"}
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
          employeeGroups={employeeGroups}
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
          employeeGroups={employeeGroups}
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
