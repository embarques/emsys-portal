"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import { useFeedback } from "@/components/app-shell/feedback-provider";
import { InvoiceBarcodeDecreaseDialog } from "@/components/invoices/invoice-barcode-decrease-dialog";
import { InvoiceFormWizard } from "@/components/invoices/invoice-form-wizard";
import {
  invoiceWizardTypographyRoot,
} from "@/components/invoices/invoice-wizard-typography";
import { useFormViewport } from "@/hooks/use-form-viewport";
import { Button } from "@/components/ui/button";
import { normalizeApiError } from "@/lib/api/axios";
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
import type { InvoiceWriteContext } from "@/lib/invoices/api/invoices-api";
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
import { buildInvoiceFormFromAppointment } from "@/lib/invoices/appointment-invoice";
import type { InvoiceAppointmentPrefill } from "@/lib/invoices/appointment-invoice-prefill";
import {
  applyAssignedInvoiceContext,
  AssignedInvoiceContextError,
  buildAssignedInvoiceWriteContext,
  employeeToInvoiceWriteRef,
} from "@/lib/invoices/assigned-invoice";
import { useAssignedInvoiceContext } from "@/lib/invoices/hooks/use-assigned-invoice-context";
import { useInvoiceCreateAccess } from "@/lib/invoices/hooks/use-invoice-create-access";
import { useOrder } from "@/lib/orders/hooks/use-orders";
import { fetchCurrentUser } from "@/lib/users/api/users-api";


type InvoiceWizardShellProps = {
  title: string;
  description: string;
  onCancel: () => void;
  initialValues: InvoiceFormValues;
  submitLabel: string;
  /** True when editing a persisted invoice (not create with a client-generated id). */
  isEditing?: boolean;
  allowPrint?: boolean;
  resetAfterSave?: boolean;
  requireDailyIncomeRegistration?: boolean;
  requirePolicySignature?: boolean;
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
  /** Rendered inside an auto-height dialog: cap the height instead of filling the viewport. */
  inDialog?: boolean;
  /** `canCreateAssignedInvoice` flow: details read-only, appointment parties only. */
  assignedMode?: boolean;
};

function InvoiceWizardShell({
  title,
  description,
  onCancel,
  initialValues,
  submitLabel,
  isEditing = false,
  allowPrint = false,
  resetAfterSave = true,
  requireDailyIncomeRegistration = false,
  requirePolicySignature = false,
  isSubmitting = false,
  initialWizardStep,
  requestEditLineItemId,
  formNonce,
  onSubmit,
  onSaved,
  onPrint,
  isPrinting = false,
  inDialog = false,
  assignedMode = false,
}: InvoiceWizardShellProps) {
  const { t } = useTranslation();
  const shellRef = useFormViewport();
  return (
    <div ref={shellRef} className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overflow-x-hidden", inDialog && "md:block", invoiceWizardTypographyRoot)}>
      <div className={cn("mx-auto flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-hidden md:max-w-6xl", inDialog && "md:block")}>
        <div
          className={cn(
            "flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-card md:rounded-xl md:border md:border-border md:shadow-sm",
            inDialog
              ? "md:max-h-[calc(100dvh-var(--form-viewport-inset,8rem))]"
              : "md:h-[calc(100dvh-var(--form-viewport-inset,8rem))] md:flex-none",
          )}
        >
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
            isEditing={isEditing}
            allowPrint={allowPrint}
            resetAfterSave={resetAfterSave}
            requireDailyIncomeRegistration={requireDailyIncomeRegistration}
            requirePolicySignature={requirePolicySignature}
            isSubmitting={isSubmitting}
            initialWizardStep={initialWizardStep}
            requestEditLineItemId={requestEditLineItemId}
            onSubmit={onSubmit}
            onSaved={onSaved}
            onPrint={onPrint}
            isPrinting={isPrinting}
            onCancel={onCancel}
            assignedMode={assignedMode}
          />
        </div>
      </div>
    </div>
  );
}

const employeeToWriteRef = employeeToInvoiceWriteRef;

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
  inDialog?: boolean;
  /** Start from an appointment: sender and receiver come from it. */
  appointmentPrefill?: InvoiceAppointmentPrefill;
};

export function InvoiceCreateWizard({
  onCancel,
  submitLabel = "Save invoice",
  inDialog = false,
  appointmentPrefill,
}: InvoiceCreateWizardProps) {
  const { t } = useTranslation();
  const { notifyAdded } = useFeedback();
  const createMutation = useCreateInvoice();
  const ensureCustomerDetail = useEnsureCustomerDetail();
  const createAccess = useInvoiceCreateAccess();
  const isAssignedOnly = createAccess.isAssignedOnly;
  const emptyValues = useMemo(() => createEmptyInvoiceForm(), []);
  const appointmentId = appointmentPrefill?.pickupId.trim() || null;
  const appointmentReceiverId = appointmentPrefill?.receiverId;
  const appointmentQuery = useOrder(appointmentId, Boolean(appointmentId));
  const assignedContextQuery = useAssignedInvoiceContext(
    emptyValues.date,
    createAccess.ready && isAssignedOnly && Boolean(appointmentId),
  );
  const assignedContext = assignedContextQuery.data ?? null;
  const [appointmentValues, setAppointmentValues] = useState<InvoiceFormValues | null>(null);

  useEffect(() => {
    // Build once; a background refetch must not replace what the user is editing.
    if (!appointmentQuery.data || appointmentValues) return;

    let cancelled = false;
    const base = buildInvoiceFormFromAppointment(
      appointmentQuery.data,
      appointmentReceiverId,
      emptyValues,
    );

    void hydrateInvoiceEditPartyCustomers(base, (customerId) =>
      ensureCustomerDetail(customerId, { staleTime: 0 }),
    )
      .then((hydrated) => {
        if (!cancelled) setAppointmentValues(hydrated);
      })
      .catch(() => {
        if (!cancelled) setAppointmentValues(base);
      });

    return () => {
      cancelled = true;
    };
  }, [appointmentQuery.data, appointmentReceiverId, appointmentValues, emptyValues, ensureCustomerDetail]);

  const initialValues = useMemo(() => {
    if (!appointmentId) return emptyValues;
    if (!appointmentValues) return null;
    if (!isAssignedOnly) return appointmentValues;
    return assignedContext ? applyAssignedInvoiceContext(appointmentValues, assignedContext) : null;
  }, [appointmentId, appointmentValues, assignedContext, emptyValues, isAssignedOnly]);

  async function handleSubmit(
    values: InvoiceFormValues,
    submitContext?: InvoiceFormSubmitContext,
  ): Promise<InvoiceFormSubmitResult> {
    try {
      const context =
        isAssignedOnly && assignedContext
          ? buildAssignedInvoiceWriteContext(assignedContext)
          : await buildInvoiceWriteContext(values);
      const registration = submitContext?.dailyIncomeRegistration ?? null;
      const incomeStatementId = submitContext?.incomeStatementId ?? registration?.incomeStatementId ?? 0;
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
          customerSignature: submitContext?.customerSignature,
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

  const blockedMessage =
    appointmentId && appointmentQuery.isError
      ? t("invoices.workspace.appointmentLoadError")
      : createAccess.ready && isAssignedOnly && !appointmentId
        ? t("invoices.assigned.errors.appointmentRequired")
        : isAssignedOnly && assignedContextQuery.isError
          ? assignedContextQuery.error instanceof AssignedInvoiceContextError
            ? t(`invoices.assigned.errors.${assignedContextQuery.error.code}`)
            : normalizeApiError(assignedContextQuery.error).message
          : null;

  if (blockedMessage) {
    return (
      <div className="flex min-h-[16rem] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="max-w-md text-sm text-destructive">{blockedMessage}</p>
        <Button variant="outline" onClick={onCancel}>
          {t("invoices.form.design.backToInvoices")}
        </Button>
      </div>
    );
  }

  if (appointmentId && !createAccess.ready) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        {t("invoices.workspace.loadingAppointment")}
      </div>
    );
  }

  if (!initialValues) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        {isAssignedOnly ? t("invoices.assigned.loading") : t("invoices.workspace.loadingAppointment")}
      </div>
    );
  }

  return (
    <InvoiceWizardShell
      title={t("invoices.workspace.addInvoice")}
      description={t("invoices.form.design.createDescription")}
      onCancel={onCancel}
      initialValues={initialValues}
      submitLabel={submitLabel}
      requireDailyIncomeRegistration
      requirePolicySignature
      isSubmitting={createMutation.isPending}
      onSubmit={handleSubmit}
      inDialog={inDialog}
      {...(appointmentId ? { resetAfterSave: false, onSaved: onCancel } : {})}
      {...(isAssignedOnly ? { assignedMode: true, initialWizardStep: 2 } : {})}
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
  inDialog?: boolean;
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
  inDialog = false,
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
      // when lowering labels (exactly currentCount - labels ObjectIDs to delete).
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
      if (!invoiceQuery.data) {
        return { error: "Unable to load this invoice." };
      }

      const saved = invoiceToFormValues(invoiceQuery.data);
      // Payment and discount are posted on create or from Daily Income, not on edit.
      const submitted: InvoiceFormValues = {
        ...values,
        discount: saved.discount,
        amountPaid: saved.amountPaid,
      };

      if (areInvoiceFormValuesEquivalent(submitted, saved)) {
        notifySuccess(t("common.form.noChanges"));
        return { error: null, savedInvoiceId: invoiceQuery.data.invoiceId };
      }

      const plan = planInvoiceBarcodeSync(invoiceQuery.data, submitted);
      if (invoiceBarcodeSyncNeedsUserInput(plan)) {
        setPendingValues(submitted);
        setPendingPlan(plan);
        setDecreaseOpen(true);
        return { error: null, deferClose: true };
      }

      return await saveInvoiceWithBarcodeSync(submitted, plan, {});
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
        isEditing
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
        inDialog={inDialog}
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
  invoicePrefill,
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

  return <InvoiceCreateWizard onCancel={returnToInvoices} appointmentPrefill={invoicePrefill} />;
}
