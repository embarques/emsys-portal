"use client";

import { ArrowLeft, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { DailyIncomeTransactionForm } from "@/components/accounting/daily-income-transaction-form";
import type { TransactionEntryCategory } from "@/lib/accounting/daily-income/transaction-type-config";
import { TransactionTypeSelector } from "@/components/accounting/transaction-type-selector";
import dynamic from "next/dynamic";
import { useLoanEntry } from "@/lib/accounting/loans/use-loan-entry";
import { useInventoryPaymentEntryAccess } from "@/lib/accounting/daily-income/use-inventory-payment-entry";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { OriginalInvoiceAdjustment } from "@/lib/accounting/daily-income/invoice-adjustment-presets";
import type { SubmitJournal } from "@/lib/accounting/daily-income/duplicate-payment";
import { useDuplicatePaymentConfirmation } from "@/lib/accounting/daily-income/use-duplicate-payment-confirmation";
import { findCashPaymentMethod, isCheckPaymentMethod, withDefaultCashPaymentMethod, type AccountingLookup, type ChartAccount, type DailyIncomeJournalValues, type JournalTransactionType } from "@/lib/accounting/daily-income/types";
import type { Employee } from "@/lib/employees/types";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { cn } from "@/lib/utils";

const LoanEntryForm = dynamic(() => import("@/components/accounting/loan-entry-dialog").then((module) => module.LoanEntryForm));
const PendingInventoryDispatchesPanel = dynamic(() => import("@/components/accounting/pending-inventory-dispatches-panel").then((module) => module.PendingInventoryDispatchesPanel));

type SharedProps = {
  summaryContainer?: HTMLElement | null;
  summaryCurrency?: string;
  onEntryActiveChange?: (active: boolean) => void;
  /** Notify hosts of the active journal type. */
  onSelectedTypeChange?: (type: JournalTransactionType | null) => void;
  open: boolean;
  presentation?: "dialog" | "tab";
  /** Host header slot (tab presentation) for the change-type control and selected type label. */
  headerActionsContainer?: HTMLElement | null;
  appearance?: "default" | "phone";
  employees: Employee[];
  dailyRoutes?: ActiveRoute[];
  statementDate?: string;
  statementBranchId?: number | null;
  accounts: ChartAccount[];
  bankAccounts: ChartAccount[];
  invoices: Invoice[];
  paymentMethods: AccountingLookup[];
  isSubmitting: boolean;
  error?: string | null;
  onSubmit: SubmitJournal;
  onCancel: () => void;
};

type AddModeProps = SharedProps & {
  mode: "add";
  initialValues?: never;
};

type EditModeProps = SharedProps & {
  mode: "edit";
  initialValues: DailyIncomeJournalValues;
};

type Props = AddModeProps | EditModeProps;

function emptyTransaction(
  type: JournalTransactionType,
  paymentMethods: AccountingLookup[] = [],
): DailyIncomeJournalValues {
  const values: DailyIncomeJournalValues = {
    transactionType: type,
    autoGenerateInvoiceNumber: type === "INITIAL-PAYMENT",
    amount: 0,
    refNumber: "",
    refNumberMode: "system",
    externalReferenceNumber: "",
    description: "",
    includeSender: false,
    includeReceiver: false,
  };

  return withDefaultCashPaymentMethod(values, paymentMethods);
}

function continueTransactionValues(
  type: JournalTransactionType,
  values: DailyIncomeJournalValues,
  paymentMethods: AccountingLookup[] = [],
): DailyIncomeJournalValues {
  return {
    ...emptyTransaction(type, paymentMethods),
    autoGenerateInvoiceNumber: type === "INITIAL-PAYMENT" ? values.autoGenerateInvoiceNumber ?? true : undefined,
    employeeId: values.employeeId,
    employeeName: values.employeeName,
    employeeGroupId: values.employeeGroupId,
    employeeGroupName: values.employeeGroupName,
    assigneeSource: values.assigneeSource,
    routeId: values.routeId,
    routeName: values.routeName,
    routeCrewId: values.routeCrewId,
    routeCrewName: values.routeCrewName,
    paymentMethodId: values.paymentMethodId,
    paymentMethodName: values.paymentMethodName,
    paymentAccountId: values.paymentAccountId,
    paymentAccountName: values.paymentAccountName,
    paymentAccountType: values.paymentAccountType,
    refNumberMode: values.refNumberMode ?? "system",
    accountId: values.accountId,
    accountName: values.accountName,
    accountType: values.accountType,
    sourceAccountId: values.sourceAccountId,
    sourceAccountName: values.sourceAccountName,
    sourceAccountType: values.sourceAccountType,
    transactionType: type,
  };
}

function clearTypeSpecificFields(
  values: DailyIncomeJournalValues,
  nextType: JournalTransactionType,
  paymentMethods: AccountingLookup[] = [],
): DailyIncomeJournalValues {
  if (values.transactionType === nextType) {
    return withDefaultCashPaymentMethod({ ...values, transactionType: nextType }, paymentMethods);
  }

  return {
    ...emptyTransaction(nextType, paymentMethods),
    employeeId: values.employeeId,
    employeeName: values.employeeName,
    employeeGroupId: values.employeeGroupId,
    employeeGroupName: values.employeeGroupName,
    assigneeSource: values.assigneeSource,
    routeId: values.routeId,
    routeName: values.routeName,
    routeCrewId: values.routeCrewId,
    routeCrewName: values.routeCrewName,
    paymentMethodId: values.paymentMethodId,
    paymentMethodName: values.paymentMethodName,
  };
}

export function AddTransactionWizard(props: Props) {
  const { t } = useTranslation();
  const formId = useId();
  const confirmation = useDuplicatePaymentConfirmation(props.open);
  const loanEntry = useLoanEntry();
  const inventoryPaymentEnabled = useInventoryPaymentEntryAccess();
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const isSubmitting = props.isSubmitting || confirmation.isSubmitting || loanEntry.pending || inventoryBusy;
  const presentation = props.presentation ?? "dialog";
  const appearance = props.appearance ?? "default";
  const isPhone = appearance === "phone";
  const isEdit = props.mode === "edit";
  const [showTypePicker, setShowTypePicker] = useState(!isEdit);
  const [specialType, setSpecialType] = useState<"INVENTORY-PAYMENT" | "LOAN-ISSUE" | "LOAN-PAYMENT" | null>(null);
  const [selectedType, setSelectedType] = useState<JournalTransactionType | null>(
    isEdit ? props.initialValues.transactionType : null,
  );
  const [detailValues, setDetailValues] = useState<DailyIncomeJournalValues>(
    isEdit ? props.initialValues : emptyTransaction("INITIAL-PAYMENT", props.paymentMethods),
  );
  const currentValuesRef = useRef<DailyIncomeJournalValues | null>(null);
  const rememberFormValues = useCallback((values: DailyIncomeJournalValues) => {
    currentValuesRef.current = values;
  }, []);
  const [formSessionKey, setFormSessionKey] = useState(0);
  const [focusSecondFieldSignal, setFocusSecondFieldSignal] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const footerError = stepError || props.error;
  const { onEntryActiveChange, onSelectedTypeChange, open } = props;
  const editInitialValues = isEdit ? props.initialValues : null;
  const originalAdjustmentType = editInitialValues?.transactionType;
  const originalAdjustmentInvoiceId = editInitialValues?.invoiceId;
  const originalAdjustmentAmount = editInitialValues?.amount;
  const originalAdjustment = useMemo<OriginalInvoiceAdjustment | undefined>(
    () =>
      (originalAdjustmentType === "DISCOUNT" || originalAdjustmentType === "SURCHARGE") &&
      originalAdjustmentInvoiceId &&
      originalAdjustmentAmount != null
        ? { invoiceId: originalAdjustmentInvoiceId, amount: originalAdjustmentAmount }
        : undefined,
    [originalAdjustmentAmount, originalAdjustmentInvoiceId, originalAdjustmentType],
  );
  const originalDiscount = originalAdjustmentType === "DISCOUNT" ? originalAdjustment : undefined;
  const originalSurcharge = originalAdjustmentType === "SURCHARGE" ? originalAdjustment : undefined;
  useEffect(() => {
    onEntryActiveChange?.(open && !showTypePicker);
  }, [onEntryActiveChange, open, showTypePicker]);
  useEffect(() => {
    onSelectedTypeChange?.(open && !showTypePicker && !specialType ? selectedType : null);
  }, [onSelectedTypeChange, open, selectedType, showTypePicker, specialType]);
  const title = isEdit
    ? t("accounting.dailyIncome.wizard.editTitle")
    : t("accounting.dailyIncome.wizard.addTitle");

  useEffect(() => {
    if (!open) return;

    if (editInitialValues) {
      setShowTypePicker(false);
      setSelectedType(editInitialValues.transactionType);
      setDetailValues(editInitialValues);
      return;
    }

    setShowTypePicker(true);
    setSpecialType(null);
    setSelectedType(null);
    setDetailValues(emptyTransaction("INITIAL-PAYMENT", props.paymentMethods));
    setFormSessionKey(0);
    setFocusSecondFieldSignal(0);
    // Reset only on opening or changing the edited entry; lookup refetches must preserve the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit, editInitialValues]);

  useEffect(() => {
    if (!props.open || isEdit) return;
    const cash = findCashPaymentMethod(props.paymentMethods);
    if (!cash) return;
    setDetailValues((current) => withDefaultCashPaymentMethod(current, props.paymentMethods));
  }, [isEdit, props.open, props.paymentMethods]);

  async function handleFormSubmit(values: DailyIncomeJournalValues) {
    try {
      const saved = await confirmation.submit(values, props.onSubmit);
      if (!saved) return;
      if (!isEdit && selectedType) {
        const continueType = selectedType === "PAYMENT" ? values.transactionType : selectedType;
        setDetailValues(continueTransactionValues(continueType, values, props.paymentMethods));
        setFormSessionKey((key) => key + 1);
        setFocusSecondFieldSignal((signal) => signal + 1);

      }
    } catch {
      // Parent surfaces API/validation errors via props.error.
    }
  }

  function handleTypeChange(type: TransactionEntryCategory) {
    if (isSubmitting) return;
    if (type === "LOAN-ISSUE" || type === "LOAN-PAYMENT" || type === "INVENTORY-PAYMENT") {
      if (type === "INVENTORY-PAYMENT" && !inventoryPaymentEnabled) return;
      if (type === "LOAN-ISSUE" && !loanEntry.openCreate) return;
      if (type === "LOAN-PAYMENT" && !loanEntry.openPayment) return;
      if (type === "LOAN-ISSUE") loanEntry.openCreate?.();
      if (type === "LOAN-PAYMENT") loanEntry.openPayment?.();
      setSpecialType(type);
      setShowTypePicker(false);
      return;
    }
    setSpecialType(null);
    if (type !== selectedType) {
      // Capture the current form before changing its key and mounting another form.
      const nextValues = clearTypeSpecificFields(currentValuesRef.current ?? detailValues, type, props.paymentMethods);
      setDetailValues(nextValues);
      setSelectedType(type);
    }
    setShowTypePicker(false);
  }

  function chooseType() {
    if (isSubmitting) return;
    if (currentValuesRef.current && !specialType) setDetailValues(currentValuesRef.current);
    loanEntry.close();
    setSpecialType(null);
    setShowTypePicker(true);
  }

  const entryHeaderActions = !isEdit && !showTypePicker ? (
    <div className="flex min-w-0 items-center gap-2">
      <Button type="button" variant="ghost" size="sm" disabled={isSubmitting} onClick={chooseType}>
        <ArrowLeft className="size-3.5" />{t("accounting.dailyIncome.wizard.changeType")}
      </Button>
      <p className="truncate text-sm font-semibold">
        {t(`accounting.dailyIncome.wizard.typeSelector.options.${specialType ?? selectedType}`)}
      </p>
    </div>
  ) : null;
  const headerActionsTarget = presentation === "tab" ? props.headerActionsContainer : null;

  const entryContent = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {presentation === "tab" && !headerActionsTarget && entryHeaderActions ? (
        <div className="flex shrink-0 justify-end border-b bg-card px-3 py-2">{entryHeaderActions}</div>
      ) : null}
      {specialType === "INVENTORY-PAYMENT" && inventoryPaymentEnabled ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <PendingInventoryDispatchesPanel presentation="inline" onBusyChange={setInventoryBusy} />
        </div>
      ) : specialType === "LOAN-ISSUE" || specialType === "LOAN-PAYMENT" ? (
        <LoanEntryForm entry={loanEntry} employees={props.employees} accounts={props.accounts} onComplete={() => { setSpecialType(null); setShowTypePicker(true); }} />
      ) : null}
      {selectedType && !specialType ? (
        <div className={cn("relative min-h-0 min-w-0 flex-1 flex-col", !showTypePicker && !specialType ? "flex" : "hidden")}>
          <fieldset disabled={isSubmitting} className="contents">
            <DailyIncomeTransactionForm
              key={`${selectedType}-${isEdit ? props.initialValues.transactionType : `add-${formSessionKey}`}`}
              summaryContainer={!showTypePicker && !specialType ? props.summaryContainer : null}
              summaryCurrency={props.summaryCurrency}
              formId={formId}
              transactionType={selectedType}
              initialValues={detailValues}
              employees={props.employees}
              dailyRoutes={props.dailyRoutes}
              statementDate={props.statementDate}
              statementBranchId={props.statementBranchId}
              accounts={props.accounts}
              bankAccounts={props.bankAccounts}
              invoices={props.invoices}
              paymentMethods={props.paymentMethods}
              showTypeSummary={false}
              showSectionNavigation={!isEdit}
              appearance={appearance}
              focusSecondFieldSignal={!isEdit ? focusSecondFieldSignal : undefined}
              allowAutoClear={!isEdit}
              originalDiscount={originalDiscount}
              originalSurcharge={originalSurcharge}
              showInvoiceDetails={selectedType === "PAYMENT"}
              onValuesChange={rememberFormValues}
              onStepErrorChange={setStepError}
              onSubmit={handleFormSubmit}
            />
          </fieldset>
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      data-testid="transaction-wizard"
      className={cn(
        "flex min-w-0 flex-col overflow-x-hidden",
        presentation === "dialog" ? "max-h-[90vh]" : "min-h-0 flex-1",
        isPhone && "h-full max-h-[100dvh] bg-background",
      )}
    >
      {presentation === "dialog" ? (
        <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("accounting.dailyIncome.wizard.description")}</DialogDescription>
          {entryHeaderActions}
        </DialogHeader>
      ) : null}
      {headerActionsTarget && entryHeaderActions ? createPortal(entryHeaderActions, headerActionsTarget) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {isEdit ? entryContent : (
          <div className={cn("flex min-h-0 flex-1 flex-col", showTypePicker ? "overflow-y-auto px-5 py-4" : "overflow-hidden")}>
            <TransactionTypeSelector value={specialType ?? selectedType} onChange={handleTypeChange} appearance={appearance}
              onGroupChange={chooseType} isBusy={isSubmitting}
              inventoryPaymentEnabled={inventoryPaymentEnabled} loanIssueEnabled={Boolean(loanEntry.openCreate)} loanPaymentEnabled={Boolean(loanEntry.openPayment)}>
              {!showTypePicker ? entryContent : null}
            </TransactionTypeSelector>
          </div>
        )}
      </div>
      {!specialType || showTypePicker ? (
        <div className={cn("shrink-0 space-y-3 border-t border-border bg-card px-5 py-3", isPhone && "pb-[calc(env(safe-area-inset-bottom)+1rem)]")}>
          {footerError ? <p role="alert" className="text-sm text-destructive">{footerError}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={props.onCancel} disabled={isSubmitting}>
              {t(showTypePicker ? "common.actions.close" : "common.actions.cancel")}
            </Button>
            {!showTypePicker && selectedType ? (
              <Button type="submit" form={formId} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {t(isSubmitting ? "common.actions.saving" : "accounting.dailyIncome.wizard.saveTransaction")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <Dialog open={Boolean(confirmation.pendingValues)} onOpenChange={(open) => { if (!open) confirmation.respond(false); }}>
        <DialogContent onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById(`${formId}-duplicate-cancel`)?.focus();
        }}>
          <DialogHeader>
            <DialogTitle>{t("accounting.dailyIncome.duplicatePayment.title")}</DialogTitle>
            <DialogDescription>{t("accounting.dailyIncome.duplicatePayment.description")}</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">{t("accounting.dailyIncome.form.fields.invoice")}</dt>
            <dd>{confirmation.pendingValues?.invoiceNumber || props.invoices.find((invoice) => invoice.invoiceId === confirmation.pendingValues?.invoiceId)?.invoiceNumber || t("common.empty.dash")}</dd>
            <dt className="text-muted-foreground">{t("accounting.dailyIncome.form.fields.paymentMethod")}</dt>
            <dd>{confirmation.pendingValues?.paymentMethodName}</dd>
            <dt className="text-muted-foreground">{t("accounting.dailyIncome.form.fields.amount")}</dt>
            <dd>{confirmation.pendingValues?.amount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</dd>
            {isCheckPaymentMethod(confirmation.pendingValues?.paymentMethodName) ? (
              <>
                <dt className="text-muted-foreground">{t("accounting.dailyIncome.form.fields.checkNumber")}</dt>
                <dd className="break-all">{confirmation.pendingValues?.checkNumber || t("common.empty.dash")}</dd>
              </>
            ) : (
              <>
                <dt className="text-muted-foreground">{t("accounting.dailyIncome.form.fields.externalReferenceNumber")}</dt>
                <dd className="break-all">{confirmation.pendingValues?.externalReferenceNumber || t("common.empty.dash")}</dd>
              </>
            )}
          </dl>
          <DialogFooter>
            <Button id={`${formId}-duplicate-cancel`} type="button" variant="outline" onClick={() => confirmation.respond(false)}>
              {t("accounting.dailyIncome.duplicatePayment.review")}
            </Button>
            <Button type="button" onClick={() => confirmation.respond(true)}>
              {t("accounting.dailyIncome.duplicatePayment.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
