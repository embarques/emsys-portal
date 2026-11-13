"use client";

import { ArrowLeft, ArrowRight, Loader2, Save, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { DailyIncomeTransactionForm } from "@/components/accounting/daily-income-transaction-form";
import { isInvoiceActionType, type TransactionEntryCategory } from "@/lib/accounting/daily-income/transaction-type-config";
import { TransactionSectionNavigation } from "@/components/accounting/transaction-section-navigation";
import { TransactionTypeSelector } from "@/components/accounting/transaction-type-selector";
import { TransactionWizardStepper } from "@/components/accounting/transaction-wizard-stepper";
import { getTransactionFormSteps, getTransactionStepLabelKey, type TransactionFormStep } from "@/lib/accounting/daily-income/transaction-workflow";
import dynamic from "next/dynamic";
import { useLoanEntry } from "@/lib/accounting/loans/use-loan-entry";
import { useInventoryPaymentEntryAccess } from "@/lib/accounting/daily-income/use-inventory-payment-entry";
import { FormFooterNoticeMessage } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { OriginalInvoiceAdjustment } from "@/lib/accounting/daily-income/invoice-adjustment-presets";
import type { SubmitJournal } from "@/lib/accounting/daily-income/duplicate-payment";
import { useDuplicatePaymentConfirmation } from "@/lib/accounting/daily-income/use-duplicate-payment-confirmation";
import { isCloseoutRequired } from "@/lib/accounting/daily-income/closeout-required";
import { findCashPaymentMethod, isCashPaymentMethod, isCheckPaymentMethod, withDefaultCashPaymentMethod, type AccountingLookup, type ChartAccount, type DailyIncomeJournal, type DailyIncomeJournalValues, type JournalTransactionType } from "@/lib/accounting/daily-income/types";
import type { Employee } from "@/lib/employees/types";
import type { Invoice } from "@/lib/invoices/types";
import { useTranslation } from "@/lib/i18n";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { cn } from "@/lib/utils";

const LoanEntryForm = dynamic(() => import("@/components/accounting/loan-entry-dialog").then((module) => module.LoanEntryForm), { loading: () => <EntryLoading /> });
const PendingInventoryDispatchesPanel = dynamic(() => import("@/components/accounting/pending-inventory-dispatches-panel").then((module) => module.PendingInventoryDispatchesPanel), { loading: () => <EntryLoading /> });

function EntryLoading() {
  const { t } = useTranslation();
  return <p role="status" className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 aria-hidden className="size-4 animate-spin" />{t("accounting.dailyIncome.wizard.loadingStep")}</p>;
}

type SharedProps = {
  summaryContainer?: HTMLElement | null;
  summaryCurrency?: string;
  onEntryActiveChange?: (active: boolean) => void;
  /** Notify hosts of the active journal type. */
  onSelectedTypeChange?: (type: JournalTransactionType | null) => void;
  open: boolean;
  presentation?: "dialog" | "tab";
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
  lookupLoading?: boolean;
  lookupError?: string | null;
  onRetryLookups?: () => void;
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
  paymentClearanceStatus?: DailyIncomeJournal["clearanceStatus"];
};

type Props = AddModeProps | EditModeProps;

/** Invoice entries stay unfocused after "save and add another"; they only autofocus when opened. */
const NO_AUTOFOCUS_AFTER_SAVE_TYPES = new Set<JournalTransactionType>(["INITIAL-PAYMENT", "PAYMENT", "SURCHARGE", "DISCOUNT"]);

function emptyTransaction(
  type: JournalTransactionType,
  paymentMethods: AccountingLookup[] = [],
): DailyIncomeJournalValues {
  const values: DailyIncomeJournalValues = {
    transactionType: type,
    autoGenerateInvoiceNumber: type === "INITIAL-PAYMENT",
    amount: 0,
    autoClear: false,
    clearPaymentOnSave: false,
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
    supervisorId: values.supervisorId,
    supervisorName: values.supervisorName,
    routeCrewId: values.routeCrewId,
    routeCrewName: values.routeCrewName,
    paymentMethodId: values.paymentMethodId,
    paymentMethodName: values.paymentMethodName,
    paymentAccountId: values.paymentAccountId,
    paymentAccountName: values.paymentAccountName,
    paymentAccountType: values.paymentAccountType,
    refNumberMode: values.refNumberMode ?? "system",
    autoClear: values.autoClear ?? false,
    autoReconcile: values.autoReconcile,
    includeSender: values.includeSender ?? false,
    includeReceiver: values.includeReceiver ?? false,
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
    supervisorId: values.supervisorId,
    supervisorName: values.supervisorName,
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
  const [activeStep, setActiveStep] = useState<TransactionFormStep>("assignment");
  const [specialType, setSpecialType] = useState<"INVENTORY-PAYMENT" | "LOAN-ISSUE" | "LOAN-INCREASE" | "LOAN-PAYMENT" | null>(null);
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
  const [skipAutofocusAfterSave, setSkipAutofocusAfterSave] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [formType, setFormType] = useState<JournalTransactionType | null>(null);
  // The existing-invoice entry (PAYMENT) can switch to a discount or surcharge inside the form.
  const activeType = selectedType === "PAYMENT" && isInvoiceActionType(formType) ? formType : selectedType;
  const footerError = stepError || props.error;
  const steps = getTransactionFormSteps(activeType);
  const stepIndex = steps.indexOf(activeStep);
  const isReview = isEdit || activeStep === "review";
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
  const originalPayment = isEdit && originalAdjustmentType === "PAYMENT" && originalAdjustmentInvoiceId && originalAdjustmentAmount != null &&
    (isCashPaymentMethod(editInitialValues?.paymentMethodName) || props.paymentClearanceStatus === "CLEARED")
    ? { invoiceId: originalAdjustmentInvoiceId, amount: originalAdjustmentAmount }
    : undefined;
  useEffect(() => {
    onEntryActiveChange?.(open && !showTypePicker);
  }, [onEntryActiveChange, open, showTypePicker]);
  useEffect(() => {
    onSelectedTypeChange?.(open && !showTypePicker && !specialType ? activeType : null);
  }, [activeType, onSelectedTypeChange, open, showTypePicker, specialType]);
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
    setActiveStep("assignment");
    setStepError(null);
    setSpecialType(null);
    setSelectedType(null);
    setFormType(null);
    setDetailValues(emptyTransaction("INITIAL-PAYMENT", props.paymentMethods));
    setFormSessionKey(0);
    setFocusSecondFieldSignal(0);
    setSkipAutofocusAfterSave(false);
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
        setActiveStep(continueType === "INVENTORY" ? "assignment" : "amounts");
        setFormSessionKey((key) => key + 1);
        const skipAutofocus = NO_AUTOFOCUS_AFTER_SAVE_TYPES.has(continueType);
        setSkipAutofocusAfterSave(skipAutofocus);
        if (!skipAutofocus) setFocusSecondFieldSignal((signal) => signal + 1);
      }
    } catch (error) {
      // Let the form open rollover setup and retry its preserved submission.
      if (isCloseoutRequired(error)) throw error;
      // Parent surfaces API/validation errors via props.error.
    }
  }

  function handleTypeChange(type: TransactionEntryCategory) {
    if (isSubmitting) return;
    setSkipAutofocusAfterSave(false);
    if (type === "LOAN-ISSUE" || type === "LOAN-INCREASE" || type === "LOAN-PAYMENT" || type === "INVENTORY-PAYMENT") {
      if (type === "INVENTORY-PAYMENT" && !inventoryPaymentEnabled) return;
      if (type === "LOAN-ISSUE" && !loanEntry.openCreate) return;
      if (type === "LOAN-INCREASE" && !loanEntry.openIncrease) return;
      if (type === "LOAN-PAYMENT" && !loanEntry.openPayment) return;
      if (type === "LOAN-ISSUE") loanEntry.openCreate?.();
      if (type === "LOAN-INCREASE") loanEntry.openIncrease?.();
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
      setActiveStep("assignment");
    }
    setStepError(null);
    setShowTypePicker(false);
  }

  function chooseType() {
    if (isSubmitting) return;
    if (currentValuesRef.current && !specialType) setDetailValues(currentValuesRef.current);
    loanEntry.close();
    setSpecialType(null);
    setShowTypePicker(true);
  }

  const entryContent = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {specialType ? (
        <TransactionSectionNavigation
          title={t(`accounting.dailyIncome.wizard.typeSelector.options.${specialType}`)}
          onBack={chooseType}
          backDisabled={isSubmitting}
        />
      ) : null}
      {specialType === "INVENTORY-PAYMENT" && inventoryPaymentEnabled ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <PendingInventoryDispatchesPanel presentation="inline" onBusyChange={setInventoryBusy} />
        </div>
      ) : specialType === "LOAN-ISSUE" || specialType === "LOAN-INCREASE" || specialType === "LOAN-PAYMENT" ? (
        <LoanEntryForm entry={loanEntry} employees={props.employees} accounts={props.accounts} summaryContainer={props.summaryContainer} onComplete={() => { setSpecialType(null); setShowTypePicker(true); }} />
      ) : null}
      {selectedType && !specialType ? (
        <div className={cn("relative min-h-0 min-w-0 flex-1 flex-col", !showTypePicker && !specialType ? "flex" : "hidden")}>
          {!isEdit ? (
            <div className="shrink-0 space-y-3 border-b bg-card px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-muted-foreground">{t(`accounting.dailyIncome.wizard.typeSelector.options.${activeType}`)}</p>
                <Button type="button" variant="ghost" size="sm" disabled={isSubmitting} onClick={chooseType}>{t("accounting.dailyIncome.wizard.changeType")}</Button>
              </div>
              <TransactionWizardStepper step={stepIndex + 1} labels={steps.map((step) => t(getTransactionStepLabelKey(step, activeType)))} disabled={isSubmitting} onSelectStep={(step) => setActiveStep(steps[step - 1])} appearance={appearance} />
            </div>
          ) : null}
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
              activeStep={isEdit ? undefined : activeStep}
              onStepChange={setActiveStep}
              onContinue={() => setActiveStep(steps[Math.min(stepIndex + 1, steps.length - 1)])}
              showSectionNavigation={false}
              onChangeType={isEdit ? undefined : chooseType}
              changeTypeDisabled={isSubmitting}
              appearance={appearance}
              focusSecondFieldSignal={!isEdit ? focusSecondFieldSignal : undefined}
              autoFocusOnMount={isEdit || !skipAutofocusAfterSave}
              allowAutoClear={!isEdit}
              originalDiscount={originalDiscount}
              originalSurcharge={originalSurcharge}
              originalPayment={originalPayment}
              showInvoiceDetails={selectedType === "PAYMENT"}
              showInvoiceActions={!isEdit && selectedType === "PAYMENT"}
              onTransactionTypeChange={setFormType}
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
        <DialogHeader className="relative shrink-0 border-b border-border px-5 py-4 pr-12">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("accounting.dailyIncome.wizard.description")}</DialogDescription>
          {/* The dialog's own close button is hidden below md by its host. */}
          {showTypePicker && !isEdit ? (
            <Button type="button" variant="ghost" size="icon" className="absolute right-4 top-4 md:hidden" aria-label={t("common.actions.close")} disabled={isSubmitting} onClick={props.onCancel}>
              <X className="size-4" />
            </Button>
          ) : null}
        </DialogHeader>
      ) : null}
      {props.lookupError ? <div className="shrink-0 px-5 py-3"><FormFooterNoticeMessage tone="error" message={t("accounting.dailyIncome.wizard.lookupError")} action={<><p className="text-xs">{props.lookupError}</p><Button type="button" variant="outline" size="sm" disabled={props.lookupLoading || isSubmitting} onClick={props.onRetryLookups}>{t("common.actions.retry")}</Button></>} /></div>
        : props.lookupLoading ? <p role="status" className="flex shrink-0 items-center gap-2 px-5 py-3 text-sm text-muted-foreground"><Loader2 aria-hidden className="size-4 animate-spin" />{t("accounting.dailyIncome.wizard.loadingOptions")}</p>
        : !showTypePicker && !specialType && activeStep === "payment" && props.paymentMethods.length === 0 ? <p role="status" className="border-b bg-muted/30 px-5 py-3 text-sm">{t("accounting.dailyIncome.wizard.noPaymentMethods")}</p> : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {isEdit ? entryContent : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className={cn(
              "flex min-h-0 flex-1 flex-col",
              !showTypePicker ? "overflow-hidden" : isPhone ? "overflow-y-auto bg-background px-4 py-5" : "overflow-y-auto bg-muted/35 p-4 sm:p-6",
            )}>
              <TransactionTypeSelector value={specialType ?? selectedType} onChange={handleTypeChange} appearance={appearance}
                onGroupChange={chooseType} isBusy={isSubmitting}
                inventoryPaymentEnabled={inventoryPaymentEnabled} loanIssueEnabled={Boolean(loanEntry.openCreate)} loanIncreaseEnabled={Boolean(loanEntry.openIncrease)} loanPaymentEnabled={Boolean(loanEntry.openPayment)}>
                {!showTypePicker ? entryContent : null}
              </TransactionTypeSelector>
            </div>
          </div>
        )}
      </div>
      {(showTypePicker ? Boolean(footerError) : !specialType) ? (
        <div className={cn("shrink-0 space-y-3 border-t border-border bg-card px-5 py-3", isPhone && "pb-[calc(env(safe-area-inset-bottom)+1rem)]")}>
          {footerError ? <FormFooterNoticeMessage tone="error" message={footerError} /> : null}
          {!showTypePicker ? <div className="flex flex-wrap items-center justify-end gap-2">
            {!isEdit && !showTypePicker && stepIndex > 0 ? (
              <Button type="button" variant="outline" className="mr-auto" disabled={isSubmitting} onClick={() => setActiveStep(steps[stepIndex - 1])}>
                <ArrowLeft className="size-4" />{t("common.actions.previous")}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={props.onCancel} disabled={isSubmitting}>
              {t("common.actions.cancel")}
            </Button>
            {!showTypePicker && selectedType ? (
              <Button type="submit" form={formId} disabled={isSubmitting} className="h-auto min-h-10 basis-full whitespace-normal py-2 sm:basis-auto">
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : isReview ? <Save className="size-4" /> : <ArrowRight className="size-4" />}
                {t(isSubmitting ? "common.actions.saving" : isReview ? "accounting.dailyIncome.wizard.saveTransaction" : activeStep === "parties" ? "accounting.dailyIncome.wizard.continueToReview" : "accounting.dailyIncome.wizard.continueToStep", { step: t(getTransactionStepLabelKey(steps[Math.min(stepIndex + 1, steps.length - 1)], activeType)) })}
              </Button>
            ) : null}
          </div> : null}
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
