"use client";

import { useEffect, useMemo } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { InvoiceFormWizard } from "@/components/invoices/invoice-form-wizard";
import {
  invoicePageDescriptionClassName,
  invoicePageEyebrowClassName,
  invoicePageTitleClassName,
  invoiceWizardTypographyRoot,
} from "@/components/invoices/invoice-wizard-typography";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { fetchContainerById } from "@/lib/containers/api/containers-api";
import { formatInvoiceTabLabel } from "@/lib/invoices/display";
import {
  useCreateInvoice,
  useInvoice,
  useUpdateInvoice,
} from "@/lib/invoices/hooks/use-invoices";
import { usePrintInvoices } from "@/lib/invoices/hooks/use-print-invoices";
import { fetchInvoices, type InvoiceWriteContext } from "@/lib/invoices/api/invoices-api";
import {
  createEmptyInvoiceForm,
  getInvoiceRecordId,
  invoiceToFormValues,
  suggestNextInvoiceNumber,
  type InvoiceFormSubmitResult,
  type InvoiceFormValues,
} from "@/lib/invoices/types";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";
import { fetchCurrentUser } from "@/lib/users/api/users-api";

type InvoiceWizardShellProps = {
  title: string;
  description: string;
  onCancel: () => void;
  initialValues: InvoiceFormValues;
  submitLabel: string;
  allowPrint?: boolean;
  resetAfterSave?: boolean;
  requireDailyIncomeRegistration?: boolean;
  isSubmitting?: boolean;
  onSubmit: (values: InvoiceFormValues) => Promise<InvoiceFormSubmitResult>;
  onSaved?: () => void;
  onPrint?: (values: InvoiceFormValues, savedInvoiceId?: string | null) => Promise<string | null>;
  isPrinting?: boolean;
};

function InvoiceWizardShell({
  title,
  description,
  onCancel,
  initialValues,
  submitLabel,
  allowPrint = false,
  resetAfterSave = true,
  requireDailyIncomeRegistration = false,
  isSubmitting = false,
  onSubmit,
  onSaved,
  onPrint,
  isPrinting = false,
}: InvoiceWizardShellProps) {
  return (
    <div className={invoiceWizardTypographyRoot}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={invoicePageEyebrowClassName}>Invoice wizard</p>
          <h1 className={invoicePageTitleClassName}>{title}</h1>
          <p className={invoicePageDescriptionClassName}>{description}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" />
            Back to invoices
          </Button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl">
        <div className="flex max-h-[calc(100vh-11rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <InvoiceFormWizard
            key={initialValues.invoiceId || "new"}
            initialValues={initialValues}
            submitLabel={submitLabel}
            allowPrint={allowPrint}
            resetAfterSave={resetAfterSave}
            requireDailyIncomeRegistration={requireDailyIncomeRegistration}
            isSubmitting={isSubmitting}
            onSubmit={onSubmit}
            onSaved={onSaved}
            onPrint={onPrint}
            isPrinting={isPrinting}
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  );
}

async function buildInvoiceWriteContext(values: InvoiceFormValues): Promise<InvoiceWriteContext> {
  const currentUser = await fetchCurrentUser();
  const containerId = Number(values.containerId);

  if (!Number.isInteger(containerId) || containerId <= 0) {
    throw new Error("A container is required.");
  }

  const container = await fetchContainerById(containerId);

  return {
    employee: {
      id: currentUser.id,
      name: currentUser.name,
      userName: currentUser.email,
      fullName: currentUser.name,
    },
    branch: {
      id: currentUser.branch.id,
      code: currentUser.branch.code,
      name: currentUser.branch.name,
    },
    container: {
      id: container.id,
      name: container.name.trim() || container.containerNumber.trim() || String(container.id),
    },
  };
}

type InvoiceCreateWizardProps = {
  onCancel: () => void;
  submitLabel?: string;
};

export function InvoiceCreateWizard({
  onCancel,
  submitLabel = "Save invoice",
}: InvoiceCreateWizardProps) {
  const { notifyAdded } = useFeedback();
  const createMutation = useCreateInvoice();
  const initialValues = useMemo(() => createEmptyInvoiceForm(), []);

  async function handleSubmit(values: InvoiceFormValues): Promise<InvoiceFormSubmitResult> {
    try {
      const context = await buildInvoiceWriteContext(values);
      const created = await createMutation.mutateAsync({ values, context });
      const recent = await fetchInvoices({ page: 1, limit: 50, sort: "number:desc" });
      notifyAdded("Invoice", created.invoiceNumber || created.invoiceId);
      return {
        error: null,
        savedInvoiceId: created.invoiceId,
        nextInvoiceNumber: suggestNextInvoiceNumber(recent.items),
      };
    } catch (error) {
      return { error: normalizeApiError(error).message };
    }
  }

  return (
    <InvoiceWizardShell
      title="Add invoice"
      description="Create a new invoice in five steps: enter invoice details, select the sender and receiver, add line items, confirm its Daily Income registration, then review totals and save."
      onCancel={onCancel}
      initialValues={initialValues}
      submitLabel={submitLabel}
      requireDailyIncomeRegistration
      isSubmitting={createMutation.isPending}
      onSubmit={handleSubmit}
    />
  );
}

type InvoiceEditWizardProps = {
  invoiceId: string;
  onCancel: () => void;
  submitLabel?: string;
};

export function InvoiceEditWizard({
  invoiceId,
  onCancel,
  submitLabel = "Save changes",
}: InvoiceEditWizardProps) {
  const { notifyUpdated } = useFeedback();
  const { printInvoice, isPrinting } = usePrintInvoices();
  const updateMutation = useUpdateInvoice();
  const invoiceQuery = useInvoice(invoiceId);

  const initialValues = useMemo(
    () => (invoiceQuery.data ? invoiceToFormValues(invoiceQuery.data) : null),
    [invoiceQuery.data],
  );

  async function handlePrint(
    values: InvoiceFormValues,
    savedInvoiceId?: string | null,
  ): Promise<string | null> {
    return printInvoice({
      invoiceId: savedInvoiceId ?? values.invoiceId,
      invoiceNumber: values.invoiceNumber,
    });
  }

  async function handleSubmit(values: InvoiceFormValues): Promise<InvoiceFormSubmitResult> {
    try {
      const context = await buildInvoiceWriteContext(values);
      const updated = await updateMutation.mutateAsync({
        invoiceId: getInvoiceRecordId({ invoiceId: values.invoiceId }),
        values,
        context,
      });
      notifyUpdated("Invoice", updated.invoiceNumber || updated.invoiceId);
      return {
        error: null,
        savedInvoiceId: updated.invoiceId,
      };
    } catch (error) {
      return { error: normalizeApiError(error).message };
    }
  }

  if (invoiceQuery.isLoading || !initialValues) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading invoice…
      </div>
    );
  }

  if (invoiceQuery.isError || !invoiceQuery.data) {
    return (
      <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-destructive">Unable to load this invoice.</p>
        <Button variant="outline" onClick={onCancel}>
          Back to invoices
        </Button>
      </div>
    );
  }

  return (
    <InvoiceWizardShell
      title={`Edit invoice ${formatInvoiceTabLabel(invoiceQuery.data)}`}
      description="Update invoice details, parties, and line items in four steps. Use Next to move forward, Back to revise a step, and the summary panel to apply an optional discount before saving."
      onCancel={onCancel}
      initialValues={initialValues}
      submitLabel={submitLabel}
      allowPrint
      resetAfterSave={false}
      isSubmitting={updateMutation.isPending}
      onSubmit={handleSubmit}
      onSaved={onCancel}
      onPrint={handlePrint}
      isPrinting={isPrinting}
    />
  );
}

export function InvoiceFormWorkspace({ tabId, mode, entityId }: WorkspaceFormHostProps) {
  const isEditing = mode === "edit";
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();
  const invoiceQuery = useInvoice(isEditing ? (entityId ?? null) : null, isEditing);

  useEffect(() => {
    if (isEditing && invoiceQuery.data) {
      updateTabLabel(tabId, formatInvoiceTabLabel(invoiceQuery.data));
    }
  }, [invoiceQuery.data, isEditing, tabId, updateTabLabel]);

  function returnToInvoices() {
    closeFormTabAndReturn(tabId);
  }

  if (isEditing) {
    if (!entityId) {
      return (
        <div className="flex min-h-[16rem] items-center justify-center text-sm text-muted-foreground">
          Invoice not found.
        </div>
      );
    }

    return <InvoiceEditWizard invoiceId={entityId} onCancel={returnToInvoices} />;
  }

  return <InvoiceCreateWizard onCancel={returnToInvoices} />;
}
