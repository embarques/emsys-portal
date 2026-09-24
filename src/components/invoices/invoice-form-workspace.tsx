"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { InvoiceBarcodeDecreaseDialog } from "@/components/invoices/invoice-barcode-decrease-dialog";
import { InvoiceFormWizard } from "@/components/invoices/invoice-form-wizard";
import {
  invoiceWizardTypographyRoot,
} from "@/components/invoices/invoice-wizard-typography";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
import { resolveOpenIncomeStatementId } from "@/lib/accounting/daily-income/api";
import type { InvoiceFormSubmitContext } from "@/lib/invoices/invoice-daily-income-context";
import { fetchBranches } from "@/lib/branches/api/branches-api";
import { resolveUserBranchRef } from "@/lib/branches/user-branch";
import { fetchContainerById } from "@/lib/containers/api/containers-api";
import { fetchEmployeeById } from "@/lib/employees/api/employees-api";
import { fetchActiveRouteById } from "@/lib/pickup-delivery-routes/api/pickup-delivery-routes-api";
import { formatInvoiceTabLabel } from "@/lib/invoices/display";
import {
  useCreateInvoice,
  useInvoice,
  useUpdateInvoice,
} from "@/lib/invoices/hooks/use-invoices";
import { usePrintInvoices } from "@/lib/invoices/hooks/use-print-invoices";
import type { InvoiceWriteContext, InvoiceWriteEmployeeRef } from "@/lib/invoices/api/invoices-api";
import { resolveInvoiceRemoveBarcodeIds } from "@/lib/invoices/api/invoice-barcode-sync-api";
import {
  invoiceBarcodeSyncNeedsUserInput,
  planInvoiceBarcodeSync,
  type InvoiceBarcodeDeletionSelection,
  type InvoiceBarcodeSyncPlan,
} from "@/lib/invoices/barcode-sync";
import {
  createEmptyInvoiceForm,
  getInvoiceRecordId,
  hydrateInvoiceEditPartyCustomers,
  invoiceToFormValues,
  areInvoiceFormValuesEquivalent,
  isInvoiceEmployeePickupSource,
  type Invoice,
  type InvoiceFormSubmitResult,
  type InvoiceFormValues,
} from "@/lib/invoices/types";
import {
  useUpdateWorkspaceTabLabel,
  useWorkspaceTabs,
} from "@/lib/layout/hooks/use-workspace-tabs";
import type { WorkspaceFormHostProps } from "@/lib/layout/workspace-form-registry";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useEnsureCustomerDetail } from "@/lib/customers/hooks/use-customers";
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
  initialWizardStep?: number;
  requestEditLineItemId?: string | null;
  formNonce?: number;
  onSubmit: (
    values: InvoiceFormValues,
    context?: InvoiceFormSubmitContext,
  ) => Promise<InvoiceFormSubmitResult>;
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
  initialWizardStep,
  requestEditLineItemId,
  formNonce,
  onSubmit,
  onSaved,
  onPrint,
  isPrinting = false,
}: InvoiceWizardShellProps) {
  const { t } = useTranslation();
  return (
    <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overflow-x-hidden md:block", invoiceWizardTypographyRoot)}>
      <div className="mx-auto flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden md:block md:max-w-6xl">
        <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-card md:max-h-[calc(100dvh-8rem)] md:rounded-xl md:border md:border-border md:shadow-sm">
          <div className="hidden shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-3 md:flex">
            <div className="min-w-0">
              <h1 className="text-base font-semibold leading-tight">{title}</h1>
              <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{description}</p>
            </div>
            <Button variant="outline" className="h-9 shrink-0" onClick={onCancel}>
              <ArrowLeft className="size-4" />
              {t("invoices.form.design.backToInvoices")}
            </Button>
          </div>
          <InvoiceFormWizard
            key={`${initialValues.invoiceId || "new"}:${formNonce ?? 0}:${initialWizardStep ?? 1}`}
            initialValues={initialValues}
            submitLabel={submitLabel}
            allowPrint={allowPrint}
            resetAfterSave={resetAfterSave}
            requireDailyIncomeRegistration={requireDailyIncomeRegistration}
            isSubmitting={isSubmitting}
            initialWizardStep={initialWizardStep}
            requestEditLineItemId={requestEditLineItemId}
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

function employeeToWriteRef(
  employee: {
    id: number;
    name: string;
    email?: string;
    user?: { email?: string } | null;
  },
  fallbackName = "",
): InvoiceWriteEmployeeRef {
  const userName = employee.user?.email?.trim() || employee.email?.trim() || undefined;
  const fullName = employee.name.trim();

  return {
    id: employee.id,
    name: fullName || fallbackName,
    ...(userName ? { userName } : {}),
    ...(fullName ? { fullName } : {}),
  };
}

async function resolveInvoicePickupAssignment(
  values: InvoiceFormValues,
): Promise<InvoiceWriteContext["pickupAssignment"]> {
  if (values.pickupSource === "route") {
    const routeId = values.routeId.trim();
    if (!routeId) return { source: "route" };

    try {
      const daily = await fetchActiveRouteById(routeId, "pickup");
      const crewName =
        daily.route.name.trim() ||
        daily.employees.map((employee) => employee.name.trim()).filter(Boolean).join(", ") ||
        daily.name;
      return {
        source: "route",
        dailyRoute: { id: daily.id, name: daily.name },
        routeCrew: { id: daily.route.id, name: crewName },
      };
    } catch {
      const crewId = values.routeCrewId.trim();
      const crewName = values.routeCrewName.trim();
      return {
        source: "route",
        dailyRoute: { id: routeId, name: crewName || routeId },
        ...(crewId ? { routeCrew: { id: crewId, name: crewName || crewId } } : {}),
      };
    }
  }

  if (isInvoiceEmployeePickupSource(values.pickupSource) && values.pickupEmployeeId.trim()) {
    const employee = await fetchEmployeeById(values.pickupEmployeeId.trim());
    return {
      source: values.pickupSource,
      pickupEmployee: employeeToWriteRef(employee, values.pickupEmployeeName),
      officeBranch: {
        id: employee.branch.id,
        code: employee.branch.code,
        name: employee.branch.name,
      },
    };
  }

  return { source: values.pickupSource };
}

async function buildInvoiceWriteContext(values: InvoiceFormValues): Promise<InvoiceWriteContext> {
  const currentUser = await fetchCurrentUser();
  const containerId = Number(values.containerId);

  if (!Number.isInteger(containerId) || containerId <= 0) {
    throw new Error("A container is required.");
  }

  const pickupAssignment = await resolveInvoicePickupAssignment(values);
  const container = await fetchContainerById(containerId);
  const branches = await fetchBranches({ page: 1, limit: 200 });
  const resolvedBranch = resolveUserBranchRef(currentUser.branch, branches.items);

  return {
    employee: pickupAssignment?.pickupEmployee,
    pickupAssignment,
    branch: {
      id: resolvedBranch?.id || currentUser.branch.id,
      code: resolvedBranch?.code || "",
      name: resolvedBranch?.name || currentUser.branch.name,
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
  const { t } = useTranslation();
  const { notifyAdded } = useFeedback();
  const createMutation = useCreateInvoice();
  const initialValues = useMemo(() => createEmptyInvoiceForm(), []);

  async function handleSubmit(
    values: InvoiceFormValues,
    submitContext?: InvoiceFormSubmitContext,
  ): Promise<InvoiceFormSubmitResult> {
    try {
      const context = await buildInvoiceWriteContext(values);
      const registration = submitContext?.dailyIncomeRegistration ?? null;
      const fallbackIncomeStatementId =
        submitContext?.incomeStatementId ??
        registration?.incomeStatementId ??
        0;
      const incomeStatementId = await resolveOpenIncomeStatementId(
        context.branch.id,
        values.date,
        fallbackIncomeStatementId,
      );
      const registeredInvoiceTotals =
        registration?.invoice && Number.isFinite(registration.invoice.cost)
          ? {
              cost: Number(registration.invoice.cost),
              payment: Number(
                registration.invoice.payment ?? registration.amount ?? values.amountPaid ?? 0,
              ),
              balance: Number(
                registration.invoice.balance ??
                  Math.max(
                    0,
                    Number(registration.invoice.cost) -
                      Number(registration.invoice.payment ?? registration.amount ?? 0),
                  ),
              ),
            }
          : undefined;
      const created = await createMutation.mutateAsync({
        values,
        context: {
          ...context,
          incomeStatement: incomeStatementId > 0 ? { id: incomeStatementId } : undefined,
          registeredInvoiceTotals,
        },
      });
      notifyAdded("Invoice", created.invoiceNumber || created.invoiceId);
      return {
        error: null,
        savedInvoiceId: created.invoiceId,
      };
    } catch (error) {
      return { error: normalizeApiError(error).message };
    }
  }

  return (
    <InvoiceWizardShell
      title={t("invoices.workspace.addInvoice")}
      description={t("invoices.form.design.createDescription")}
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
  initialWizardStep?: number;
  focusBarcodeId?: string;
  formNonce?: number;
};

function findLineItemIdForBarcodeFocus(invoice: Invoice, focusBarcodeId: string): string | null {
  const target = focusBarcodeId.trim();
  if (!target) return null;

  for (const item of invoice.lineItems) {
    for (const barcode of item.barcodes ?? []) {
      const objectId = barcode.barcodeId?.trim();
      if (objectId && objectId === target) return item.id;
      if (barcode.id.trim() === target) return item.id;
      if (barcode.number.trim() === target) return item.id;
    }
  }
  return null;
}

export function InvoiceEditWizard({
  invoiceId,
  onCancel,
  submitLabel = "Save changes",
  initialWizardStep,
  focusBarcodeId,
  formNonce,
}: InvoiceEditWizardProps) {
  const { t } = useTranslation();
  const { notifyUpdated, notifySuccess, notifyError } = useFeedback();
  const { printInvoice, isPrinting } = usePrintInvoices();
  const updateMutation = useUpdateInvoice();
  const invoiceQuery = useInvoice(invoiceId);
  const ensureCustomerDetail = useEnsureCustomerDetail();
  const [initialValues, setInitialValues] = useState<InvoiceFormValues | null>(null);
  const [pendingValues, setPendingValues] = useState<InvoiceFormValues | null>(null);
  const [pendingPlan, setPendingPlan] = useState<InvoiceBarcodeSyncPlan | null>(null);
  const [decreaseOpen, setDecreaseOpen] = useState(false);
  const [isSyncingBarcodes, setIsSyncingBarcodes] = useState(false);

  useEffect(() => {
    if (!invoiceQuery.data) {
      setInitialValues(null);
      return;
    }

    let cancelled = false;
    const base = invoiceToFormValues(invoiceQuery.data);

    void hydrateInvoiceEditPartyCustomers(base, (customerId) =>
      ensureCustomerDetail(customerId, { staleTime: 0 }),
    )
      .then((hydrated) => {
        if (!cancelled) setInitialValues(hydrated);
      })
      .catch(() => {
        // Fall back to the invoice snapshot if live customer loads fail.
        if (!cancelled) setInitialValues(base);
      });

    return () => {
      cancelled = true;
    };
  }, [ensureCustomerDetail, invoiceQuery.data]);

  async function handlePrint(
    values: InvoiceFormValues,
    savedInvoiceId?: string | null,
  ): Promise<string | null> {
    return printInvoice({
      invoiceId: savedInvoiceId ?? values.invoiceId,
      invoiceNumber: values.invoiceNumber,
    });
  }

  async function saveInvoiceWithBarcodeSync(
    values: InvoiceFormValues,
    plan: InvoiceBarcodeSyncPlan,
    deletions: InvoiceBarcodeDeletionSelection,
  ): Promise<InvoiceFormSubmitResult> {
    if (!invoiceQuery.data) {
      return { error: "Unable to load this invoice." };
    }

    setIsSyncingBarcodes(true);
    try {
      // API owns mint/delete/description sync. Portal only sends removeBarcodeIds
      // when lowering labels (ObjectID barcodeId per removed label on that detail).
      const removeBarcodeIdsByDetail =
        plan.decreases.length > 0
          ? resolveInvoiceRemoveBarcodeIds({ plan, deletions })
          : undefined;

      const context = await buildInvoiceWriteContext(values);
      const updated = await updateMutation.mutateAsync({
        invoiceId: getInvoiceRecordId({ invoiceId: values.invoiceId }),
        values,
        context,
        removeBarcodeIdsByDetail,
      });

      notifyUpdated("Invoice", updated.invoiceNumber || updated.invoiceId);
      return {
        error: null,
        savedInvoiceId: updated.invoiceId,
      };
    } catch (error) {
      return { error: normalizeApiError(error).message };
    } finally {
      setIsSyncingBarcodes(false);
      setPendingValues(null);
      setPendingPlan(null);
      setDecreaseOpen(false);
    }
  }

  async function handleSubmit(values: InvoiceFormValues): Promise<InvoiceFormSubmitResult> {
    try {
      if (
        invoiceQuery.data &&
        areInvoiceFormValuesEquivalent(values, invoiceToFormValues(invoiceQuery.data))
      ) {
        notifySuccess(t("common.form.noChanges"));
        return { error: null, savedInvoiceId: invoiceQuery.data.invoiceId };
      }

      if (!invoiceQuery.data) {
        return { error: "Unable to load this invoice." };
      }

      const plan = planInvoiceBarcodeSync(invoiceQuery.data, values);
      if (invoiceBarcodeSyncNeedsUserInput(plan)) {
        setPendingValues(values);
        setPendingPlan(plan);
        setDecreaseOpen(true);
        return { error: null, deferClose: true };
      }

      return await saveInvoiceWithBarcodeSync(values, plan, {});
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
    <>
      <InvoiceWizardShell
        title={t("invoices.workspace.editInvoiceNamed", {
          number: formatInvoiceTabLabel(invoiceQuery.data, t("invoices.workspace.untitledTab")),
        })}
        description={t("invoices.form.design.editDescription")}
        onCancel={onCancel}
        initialValues={initialValues}
        submitLabel={submitLabel}
        allowPrint
        resetAfterSave={false}
        isSubmitting={updateMutation.isPending || isSyncingBarcodes}
        initialWizardStep={initialWizardStep}
        requestEditLineItemId={
          focusBarcodeId
            ? findLineItemIdForBarcodeFocus(invoiceQuery.data, focusBarcodeId)
            : null
        }
        formNonce={formNonce}
        onSubmit={handleSubmit}
        onSaved={onCancel}
        onPrint={handlePrint}
        isPrinting={isPrinting}
      />
      <InvoiceBarcodeDecreaseDialog
        open={decreaseOpen}
        decreases={pendingPlan?.decreases ?? []}
        onOpenChange={(open) => {
          if (!open && !isSyncingBarcodes) {
            setDecreaseOpen(false);
            setPendingValues(null);
            setPendingPlan(null);
          }
        }}
        onConfirm={(selections) => {
          if (!pendingValues || !pendingPlan) return;
          void saveInvoiceWithBarcodeSync(pendingValues, pendingPlan, selections).then((result) => {
            if (result.error) {
              notifyError(result.error);
              return;
            }
            onCancel();
          });
        }}
      />
    </>
  );
}

export function InvoiceFormWorkspace({
  tabId,
  mode,
  entityId,
  initialWizardStep,
  focusBarcodeId,
  formNonce,
}: WorkspaceFormHostProps) {
  const isEditing = mode === "edit";
  const { t } = useTranslation();
  const { closeFormTabAndReturn } = useWorkspaceTabs();
  const updateTabLabel = useUpdateWorkspaceTabLabel();
  const invoiceQuery = useInvoice(isEditing ? (entityId ?? null) : null, isEditing);

  useEffect(() => {
    if (isEditing && invoiceQuery.data) {
      updateTabLabel(
        tabId,
        formatInvoiceTabLabel(invoiceQuery.data, t("invoices.workspace.untitledTab")),
      );
    }
  }, [invoiceQuery.data, isEditing, t, tabId, updateTabLabel]);

  function returnToInvoices() {
    closeFormTabAndReturn(tabId);
  }

  if (isEditing) {
    if (!entityId) {
      return (
        <div className="flex min-h-[16rem] items-center justify-center text-sm text-muted-foreground">
          {t("invoices.workspace.invoiceNotFound")}
        </div>
      );
    }

    return (
      <InvoiceEditWizard
        invoiceId={entityId}
        onCancel={returnToInvoices}
        initialWizardStep={initialWizardStep}
        focusBarcodeId={focusBarcodeId}
        formNonce={formNonce}
      />
    );
  }

  return <InvoiceCreateWizard onCancel={returnToInvoices} />;
}
