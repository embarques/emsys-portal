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
import { formatInvoiceTabLabel } from "@/lib/invoices/display";
import { useInvoice } from "@/lib/invoices/hooks/use-invoices";
import { usePrintInvoices } from "@/lib/invoices/hooks/use-print-invoices";
import {
  createEmptyInvoiceForm,
  invoiceToFormValues,
  type InvoiceFormSubmitResult,
  type InvoiceFormValues,
} from "@/lib/invoices/types";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";

type InvoiceWizardShellProps = {
  title: string;
  description: string;
  onCancel: () => void;
  initialValues: InvoiceFormValues;
  submitLabel: string;
  allowPrint?: boolean;
  onSubmit: (values: InvoiceFormValues) => InvoiceFormSubmitResult;
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
  onSubmit,
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
            key={`${initialValues.invoiceId || "new"}-${initialValues.invoiceNumber}`}
            initialValues={initialValues}
            submitLabel={submitLabel}
            allowPrint={allowPrint}
            onSubmit={onSubmit}
            onPrint={onPrint}
            isPrinting={isPrinting}
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  );
}

type InvoiceCreateWizardProps = {
  onCancel: () => void;
  submitLabel?: string;
};

export function InvoiceCreateWizard({
  onCancel,
  submitLabel = "Save invoice",
}: InvoiceCreateWizardProps) {
  const { notifySuccess } = useFeedback();

  function handleSubmit(values: InvoiceFormValues): InvoiceFormSubmitResult {
    notifySuccess(`Invoice #${values.invoiceNumber || "draft"} validated.`);
    return {
      error: null,
      nextInvoiceNumber: values.invoiceNumber ? `${values.invoiceNumber}-next` : "",
    };
  }

  return (
    <InvoiceWizardShell
      title="Add invoice"
      description="Create a new invoice in four steps: enter invoice details, select the sender and receiver, add line items, then review totals and save. Use Next to move forward, Back to revise a step, and the summary panel to apply an optional discount before saving."
      onCancel={onCancel}
      initialValues={createEmptyInvoiceForm()}
      submitLabel={submitLabel}
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
  const { notifySuccess } = useFeedback();
  const { printInvoice, isPrinting } = usePrintInvoices();
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

  function handleSubmit(values: InvoiceFormValues): InvoiceFormSubmitResult {
    notifySuccess(`Invoice #${values.invoiceNumber || "draft"} validated.`);
    return {
      error: null,
      savedInvoiceId: values.invoiceId,
    };
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
      onSubmit={handleSubmit}
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
