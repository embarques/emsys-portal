"use client";

import { ArrowRight, Copy, Loader2, Save, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { DailyIncomeTransactionForm } from "@/components/accounting/daily-income-transaction-form";
import { type TransactionEntryCategory } from "@/lib/accounting/daily-income/transaction-type-config";
import type { GuidedTypeStep } from "@/components/accounting/guided-entry-chrome";
import { TransactionTypeSelector } from "@/components/accounting/transaction-type-selector";
import { TransactionWizardStepper } from "@/components/accounting/transaction-wizard-stepper";
import {
  getDefaultBatchContinueStep,
  getTransactionFormSteps,
  getTransactionStepLabelKey,
  type TransactionFormStep,
} from "@/lib/accounting/daily-income/transaction-workflow";
import {
  continueTransactionValues,
  continueTransactionValuesFromStep,
  emptyTransaction,
} from "@/lib/accounting/daily-income/batch-continue";
import dynamic from "next/dynamic";
import { useLoanEntry } from "@/lib/accounting/loans/use-loan-entry";
import { useInventoryPaymentEntryAccess } from "@/lib/accounting/daily-income/use-inventory-payment-entry";
import { useResponsibilityRequiredRecoveryAction } from "@/components/accounting/open-employees-recovery-action";
import { FormFooterNoticeMessage } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import {
  CompactActionDialogBody,
  CompactActionDialogContent,
  CompactActionDialogFooter,
  CompactActionDialogHeader,
} from "@/components/forms/compact-action-dialog";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [typePickerKey, setTypePickerKey] = useState(0);
  const [activeStep, setActiveStep] = useState<TransactionFormStep>("assignment");
  const [batchStartStep, setBatchStartStep] = useState<TransactionFormStep | null>(null);
  const batchStartStepRef = useRef<TransactionFormStep | null>(null);
  batchStartStepRef.current = batchStartStep;
  const [specialType, setSpecialType] = useState<
    "INVENTORY-PAYMENT" | "LOAN-ISSUE" | "LOAN-INCREASE" | "LOAN-DECREASE" | "LOAN-PAYMENT" | null
  >(null);
  const [selectedType, setSelectedType] = useState<JournalTransactionType | null>(
    isEdit ? props.initialValues.transactionType : null,
  );
  const [detailValues, setDetailValues] = useState<DailyIncomeJournalValues>(
    isEdit ? props.initialValues : emptyTransaction("INITIAL-PAYMENT", props.paymentMethods),
  );
  const currentValuesRef = useRef<DailyIncomeJournalValues | null>(null);
  const [liveAmount, setLiveAmount] = useState(() => Number(detailValues.amount) || 0);
  const rememberFormValues = useCallback((values: DailyIncomeJournalValues) => {
    currentValuesRef.current = values;
    setLiveAmount(Number(values.amount) || 0);
  }, []);
  const [formSessionKey, setFormSessionKey] = useState(0);
  const [loanSessionKey, setLoanSessionKey] = useState(0);
  const [focusSecondFieldSignal, setFocusSecondFieldSignal] = useState(0);
  const [skipAutofocusAfterSave, setSkipAutofocusAfterSave] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const footerError = stepError || props.error;
  const responsibilityAction = useResponsibilityRequiredRecoveryAction(footerError);
  const steps = getTransactionFormSteps(selectedType, liveAmount);
  const stepIndex = steps.indexOf(activeStep);
  // Choosing the type is step 1 of the add workflow; the form's own steps follow it.
  const stepperLabels = [
    !showTypePicker && selectedType ? t(`accounting.dailyIncome.wizard.typeSelector.options.${selectedType}`) : t("accounting.dailyIncome.wizard.steps.selectType"),
    ...steps.map((step) => t(getTransactionStepLabelKey(step, selectedType))),
  ];
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
    onSelectedTypeChange?.(open && !showTypePicker && !specialType ? selectedType : null);
  }, [selectedType, onSelectedTypeChange, open, showTypePicker, specialType]);
  const title = isEdit
    ? t("accounting.dailyIncome.wizard.editTitle")
    : t("accounting.dailyIncome.wizard.addTitle");

  useEffect(() => {
    if (!open) return;

    if (editInitialValues) {
      setShowTypePicker(false);
      setSelectedType(editInitialValues.transactionType);
      setDetailValues(editInitialValues);
      setLiveAmount(Number(editInitialValues.amount) || 0);
      return;
    }

    setShowTypePicker(true);
    setTypePickerKey((key) => key + 1);
    setActiveStep("assignment");
    setBatchStartStep(null);
    setStepError(null);
    setSpecialType(null);
    setSelectedType(null);
    const nextValues = emptyTransaction("INITIAL-PAYMENT", props.paymentMethods);
    setDetailValues(nextValues);
    setLiveAmount(Number(nextValues.amount) || 0);
    setFormSessionKey(0);
    setLoanSessionKey(0);
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
        // Payment discovery always restarts on search (PAYMENT); create-new is chosen again if needed.
        const continueType = selectedType === "INITIAL-PAYMENT" ? "PAYMENT" : selectedType;
        // Continue drafts clear amount; use 0 so unpaid INITIAL-PAYMENT pins stay valid against the next type's steps.
        const continueSteps = getTransactionFormSteps(continueType, 0);
        // Read the ref so a long save/duplicate confirm still uses the mark from submit time.
        const markedAtSubmit = batchStartStepRef.current;
        const markedStep = markedAtSubmit && continueSteps.includes(markedAtSubmit) ? markedAtSubmit : null;
        if (markedAtSubmit && !markedStep) setBatchStartStep(null);
        // Batch continue keeps the chosen transaction type; never bounce back to the type picker.
        setShowTypePicker(false);
        setSelectedType(continueType);
        const continueDraft = markedStep
          ? continueTransactionValuesFromStep(continueType, values, markedStep, props.paymentMethods)
          : continueTransactionValues(continueType, values, props.paymentMethods);
        setDetailValues(continueDraft);
        setLiveAmount(Number(continueDraft.amount) || 0);
        // Stay on the chosen type; resume at the batch pin or the first step after type selection.
        setActiveStep(markedStep ?? getDefaultBatchContinueStep(continueType));
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
    if (
      type === "LOAN-ISSUE" ||
      type === "LOAN-INCREASE" ||
      type === "LOAN-DECREASE" ||
      type === "LOAN-PAYMENT" ||
      type === "INVENTORY-PAYMENT"
    ) {
      if (type === "INVENTORY-PAYMENT" && !inventoryPaymentEnabled) return;
      if (type === "LOAN-ISSUE" && !loanEntry.openCreate) return;
      if (type === "LOAN-INCREASE" && !loanEntry.openIncrease) return;
      if (type === "LOAN-DECREASE" && !loanEntry.openDecrease) return;
      if (type === "LOAN-PAYMENT" && !loanEntry.openPayment) return;
      if (type === "LOAN-ISSUE") loanEntry.openCreate?.();
      if (type === "LOAN-INCREASE") loanEntry.openIncrease?.();
      if (type === "LOAN-DECREASE") loanEntry.openDecrease?.();
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
      setLiveAmount(Number(nextValues.amount) || 0);
      setSelectedType(type);
      setActiveStep("assignment");
      const nextSteps = getTransactionFormSteps(type, Number(nextValues.amount) || 0);
      setBatchStartStep((current) => (current && nextSteps.includes(current) ? current : null));
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

  // Loans and inventory payments run their own steps; they continue this wizard's type step, stepper and footer.
  const specialTypeStep: GuidedTypeStep | null = specialType ? {
    label: t(`accounting.dailyIncome.wizard.typeSelector.options.${specialType}`),
    onBack: chooseType,
    onCancel: () => { loanEntry.close(); props.onCancel(); },
    appearance,
  } : null;

  const entryContent = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {specialType === "INVENTORY-PAYMENT" && inventoryPaymentEnabled && specialTypeStep ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <PendingInventoryDispatchesPanel presentation="inline" onBusyChange={setInventoryBusy} typeStep={specialTypeStep} />
        </div>
      ) : (
        specialType === "LOAN-ISSUE" ||
        specialType === "LOAN-INCREASE" ||
        specialType === "LOAN-DECREASE" ||
        specialType === "LOAN-PAYMENT"
      ) && specialTypeStep ? (
        <LoanEntryForm
          key={loanSessionKey}
          entry={loanEntry}
          employees={props.employees}
          accounts={props.accounts}
          summaryContainer={props.summaryContainer}
          typeStep={specialTypeStep}
          onSaved={() => {
            // Keep the loan type selected and remount at step 1 for the next entry.
            const kind = specialType;
            setLoanSessionKey((key) => key + 1);
            if (kind === "LOAN-ISSUE") loanEntry.openCreate?.();
            else if (kind === "LOAN-INCREASE") loanEntry.openIncrease?.();
            else if (kind === "LOAN-DECREASE") loanEntry.openDecrease?.();
            else if (kind === "LOAN-PAYMENT") loanEntry.openPayment?.();
          }}
          onDismiss={() => {
            setSpecialType(null);
            setShowTypePicker(true);
          }}
        />
      ) : null}
      {selectedType && !specialType ? (
        <div className={cn("relative min-h-0 min-w-0 flex-1 flex-col", !showTypePicker && !specialType ? "flex" : "hidden")}>
          <fieldset disabled={isSubmitting} className="contents">
            <DailyIncomeTransactionForm
              editing={isEdit}
              key={`${
                selectedType === "PAYMENT" || selectedType === "INITIAL-PAYMENT" ? "invoice-payment" : selectedType
              }-${isEdit ? props.initialValues.transactionType : `add-${formSessionKey}`}`}
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
              onStepBack={
                isEdit
                  ? undefined
                  : () => {
                      if (stepIndex > 0) {
                        setActiveStep(steps[stepIndex - 1]);
                        return;
                      }
                      // Batch only preloads later steps; back can still reopen type selection.
                      chooseType();
                    }
              }
              stepBackDisabled={isSubmitting}
              appearance={appearance}
              focusSecondFieldSignal={!isEdit ? focusSecondFieldSignal : undefined}
              autoFocusOnMount={isEdit || !skipAutofocusAfterSave}
              allowAutoClear={!isEdit}
              invoiceDiscovery={!isEdit && (selectedType === "PAYMENT" || selectedType === "INITIAL-PAYMENT")}
              onTransactionTypeChange={
                isEdit
                  ? undefined
                  : (type) => {
                      setSelectedType(type);
                      // Discovery switches type after setValue; use the live form draft so reset
                      // keeps the selected invoice (or create-new fields) instead of stale detailValues.
                      setDetailValues((current) => ({
                        ...(currentValuesRef.current ?? current),
                        transactionType: type,
                      }));
                      const nextSteps = getTransactionFormSteps(type);
                      setBatchStartStep((current) => (current && nextSteps.includes(current) ? current : null));
                    }
              }
              originalDiscount={originalDiscount}
              originalSurcharge={originalSurcharge}
              originalPayment={originalPayment}
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
        : !showTypePicker && !specialType && activeStep === "payment" && props.paymentMethods.length === 0 ? <p role="status" className="border-b bg-muted/30 px-5 py-3 text-sm">{t("accounting.dailyIncome.wizard.noPaymentMethods")}</p> : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {isEdit ? entryContent : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {!specialType ? (
              <div className="shrink-0 border-b bg-card px-5 py-4">
                {showTypePicker || !selectedType ? (
                  <TransactionWizardStepper step={1} labels={stepperLabels} disabled onSelectStep={() => undefined} appearance={appearance} />
                ) : (
                  <TransactionWizardStepper
                    step={stepIndex + 2}
                    labels={stepperLabels}
                    disabled={isSubmitting}
                    onSelectStep={(step) => (step === 1 ? chooseType() : setActiveStep(steps[step - 2]))}
                    appearance={appearance}
                    batchPin={{
                      // Type picker (1) and Review are not resume targets for batch continue.
                      pinnableSteps: steps.flatMap((formStep, index) =>
                        formStep === "review" ? [] : [index + 2],
                      ),
                      pinnedStep:
                        batchStartStep && steps.includes(batchStartStep)
                          ? steps.indexOf(batchStartStep) + 2
                          : null,
                      onPinnedStepChange: (stepNumber) => {
                        if (stepNumber == null) {
                          setBatchStartStep(null);
                          return;
                        }
                        const formStep = steps[stepNumber - 2];
                        setBatchStartStep(formStep && formStep !== "review" ? formStep : null);
                      },
                      disabled: isSubmitting,
                    }}
                  />
                )}
              </div>
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <TransactionTypeSelector
                value={specialType ?? selectedType}
                onChange={handleTypeChange}
                appearance={appearance}
                formActive={!showTypePicker}
                typePickerKey={typePickerKey}
                onGroupChange={chooseType}
                isBusy={isSubmitting}
                inventoryPaymentEnabled={inventoryPaymentEnabled}
                loanIssueEnabled={Boolean(loanEntry.openCreate)}
                loanIncreaseEnabled={Boolean(loanEntry.openIncrease)}
                loanDecreaseEnabled={Boolean(loanEntry.openDecrease)}
                loanPaymentEnabled={Boolean(loanEntry.openPayment)}
              >
                {entryContent}
              </TransactionTypeSelector>
              {showTypePicker && props.lookupLoading ? (
                <p role="status" className={cn(
                  "flex shrink-0 items-center gap-2 border-t border-border/60 text-sm text-muted-foreground",
                  isPhone ? "px-4 py-3" : "px-4 py-3 sm:px-6 lg:px-8",
                )}>
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                  {t("accounting.dailyIncome.wizard.loadingOptions")}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
      {(showTypePicker ? Boolean(footerError) : !specialType) ? (
        <div className={cn("shrink-0 space-y-3 border-t border-border bg-card px-5 py-3", isPhone && "pb-[calc(env(safe-area-inset-bottom)+1rem)]")}>
          {footerError ? (
            <FormFooterNoticeMessage tone="error" message={footerError} action={responsibilityAction} />
          ) : null}
          {!showTypePicker ? <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={props.onCancel} disabled={isSubmitting}>
              {t("common.actions.cancel")}
            </Button>
            {selectedType ? (
              <Button type="submit" form={formId} disabled={isSubmitting} className="h-auto min-h-10 basis-full whitespace-normal py-2 sm:basis-auto">
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : isReview ? <Save className="size-4" /> : <ArrowRight className="size-4" />}
                {t(isSubmitting ? "common.actions.saving" : isReview ? "accounting.dailyIncome.wizard.saveTransaction" : activeStep === "parties" ? "accounting.dailyIncome.wizard.continueToReview" : "accounting.dailyIncome.wizard.continueToStep", { step: t(getTransactionStepLabelKey(steps[Math.min(stepIndex + 1, steps.length - 1)], selectedType)) })}
              </Button>
            ) : null}
          </div> : null}
        </div>
      ) : null}
      <Dialog open={Boolean(confirmation.pendingValues)} onOpenChange={(open) => { if (!open) confirmation.respond(false); }}>
        <CompactActionDialogContent
          onOpenAutoFocus={(event) => {
            document.getElementById(`${formId}-duplicate-cancel`)?.focus();
            event.preventDefault();
          }}
        >
          <CompactActionDialogHeader
            icon={Copy}
            title={t("accounting.dailyIncome.duplicatePayment.title")}
            description={t("accounting.dailyIncome.duplicatePayment.description")}
          />
          <CompactActionDialogBody>
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
          </CompactActionDialogBody>
          <CompactActionDialogFooter>
            <Button id={`${formId}-duplicate-cancel`} type="button" variant="outline" onClick={() => confirmation.respond(false)}>
              {t("accounting.dailyIncome.duplicatePayment.review")}
            </Button>
            <Button type="button" onClick={() => confirmation.respond(true)}>
              {t("accounting.dailyIncome.duplicatePayment.confirm")}
            </Button>
          </CompactActionDialogFooter>
        </CompactActionDialogContent>
      </Dialog>
    </div>
  );
}
