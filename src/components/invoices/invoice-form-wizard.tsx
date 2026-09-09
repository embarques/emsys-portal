"use client";

import { ArrowLeft, ArrowRight, ExternalLink, Loader2, Printer, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { InvoiceForm } from "@/components/invoices/invoice-form";
import { InvoiceDailyIncomeStep } from "@/components/invoices/invoice-daily-income-step";
import { InvoiceFormPreviewStep } from "@/components/invoices/invoice-form-preview-step";
import { InvoiceWizardNotice } from "@/components/invoices/invoice-wizard-notice";
import {
  InvoiceWizardSummaryMobileBar,
  InvoiceWizardSummarySidebar,
} from "@/components/invoices/invoice-wizard-summary-panel";
import {
  getInvoiceWizardStepLabelKey,
  getInvoiceWizardStepTitleKey,
  InvoiceWizardStepper,
  type InvoiceWizardStep,
  type InvoiceWizardFormStep,
  INVOICE_WIZARD_STEP_ORDER,
} from "@/components/invoices/invoice-wizard-stepper";
import {
  invoiceStepEyebrowClassName,
  invoiceStepTitleClassName,
  invoiceWizardTypographyRoot,
} from "@/components/invoices/invoice-wizard-typography";
import { Button } from "@/components/ui/button";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import { buildDailyIncomeWorkspaceHref } from "@/lib/accounting/daily-income/workspace-href";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
import { customerHasUnverifiedPrimaryAddress } from "@/lib/customers/types";
import { isMissingOpenIncomeStatementError } from "@/lib/invoices/missing-open-income-statement";
import { useTranslation } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/users/hooks/use-users";
import { cn } from "@/lib/utils";
import {
  canContinueInvoiceDailyIncomeStep,
  emptyInvoiceDailyIncomeContext,
  toInvoiceFormSubmitContext,
  type InvoiceDailyIncomeContext,
  type InvoiceFormSubmitContext,
} from "@/lib/invoices/invoice-daily-income-context";
import {
  createEmptyInvoiceForm,
  getInvoiceFormBalance,
  isInvoiceEmployeePickupSource,
  resetInvoiceFormForNextEntry,
  hasInvoiceLineItemContent,
  type InvoiceFormSubmitResult,
  type InvoiceFormValues,
} from "@/lib/invoices/types";

type Props = {
  initialValues?: InvoiceFormValues;
  submitLabel: string;
  externalError?: string | null;
  /** Print is only available when editing a saved invoice in the database. */
  allowPrint?: boolean;
  isSubmitting?: boolean;
  resetAfterSave?: boolean;
  /**
   * Include the payment / Daily Income (Cuadre) step on create.
   * An open Cuadre must be associated and a payment recorded (amount may be $0)
   * before continuing — same click-Next-then-error pattern as other steps.
   */
  requireDailyIncomeRegistration?: boolean;
  onSubmit: (
    values: InvoiceFormValues,
    context?: InvoiceFormSubmitContext,
  ) => InvoiceFormSubmitResult | Promise<InvoiceFormSubmitResult>;
  onSaved?: () => void;
  onPrint?: (values: InvoiceFormValues, savedInvoiceId?: string | null) => Promise<string | null>;
  isPrinting?: boolean;
  onCancel: () => void;
};

export function InvoiceFormWizard({
  initialValues,
  submitLabel,
  externalError = null,
  allowPrint = false,
  isSubmitting = false,
  resetAfterSave = true,
  requireDailyIncomeRegistration = false,
  onSubmit,
  onSaved,
  onPrint,
  isPrinting = false,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const isMobileLayout = useIsMobileViewport();
  const currentUserQuery = useCurrentUser();
  const [step, setStep] = useState<InvoiceWizardStep>(1);
  const [values, setValues] = useState<InvoiceFormValues>(
    initialValues ?? createEmptyInvoiceForm(),
  );
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [formSessionKey, setFormSessionKey] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const valuesRef = useRef(values);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dailyIncomeContext, setDailyIncomeContext] = useState<InvoiceDailyIncomeContext>(
    emptyInvoiceDailyIncomeContext(),
  );
  const previewStep: InvoiceWizardStep = requireDailyIncomeRegistration ? 5 : 4;
  const canContinuePaymentStep = canContinueInvoiceDailyIncomeStep(dailyIncomeContext);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const previousReceiverIdRef = useRef(values.receiverId);

  const validateStep1 = useCallback(
    (formValues: InvoiceFormValues): string | null => {
      if (!formValues.date.trim()) return t("invoices.wizard.validation.dateRequired");
      if (!formValues.invoiceNumber.trim()) return t("invoices.wizard.validation.invoiceNumberRequired");
      if (!formValues.containerId) return t("invoices.wizard.validation.containerRequired");
      if (!formValues.paymentLocation) return t("invoices.wizard.validation.paymentLocationRequired");
      if (formValues.pickupSource === "route") {
        if (!formValues.routeId) return t("invoices.wizard.validation.pickupRouteRequired");
      } else if (isInvoiceEmployeePickupSource(formValues.pickupSource)) {
        if (!formValues.pickupEmployeeId) {
          return formValues.pickupSource === "warehouse"
            ? t("invoices.wizard.validation.warehouseEmployeeRequired")
            : t("invoices.wizard.validation.officeEmployeeRequired");
        }
      }
      return null;
    },
    [t],
  );

  const validateStep2 = useCallback(
    (formValues: InvoiceFormValues): string | null => {
      if (!formValues.sender) return t("invoices.wizard.validation.senderRequired");
      if (isGoogleMapsConfigured() && customerHasUnverifiedPrimaryAddress(formValues.sender)) {
        return t("invoices.wizard.validation.unverifiedSenderAddress");
      }
      return null;
    },
    [t],
  );

  useEffect(() => {
    const previousReceiverId = previousReceiverIdRef.current.trim();
    const nextReceiverId = values.receiverId.trim();
    previousReceiverIdRef.current = nextReceiverId;

    if (step !== 2) return;
    if (!nextReceiverId || !values.receiver || nextReceiverId === previousReceiverId) return;
    if (validateStep2(values)) return;

    setStepError(null);
    setSubmitError(null);
    setStep(3);
  }, [step, values, validateStep2]);

  const validateStep3 = useCallback(
    (formValues: InvoiceFormValues): string | null => {
      const hasContent = formValues.lineItems.some(hasInvoiceLineItemContent);
      if (!hasContent) return t("invoices.wizard.validation.lineItemRequired");
      return null;
    },
    [t],
  );

  const validateForSave = useCallback(
    (formValues: InvoiceFormValues): string | null => {
      const stepError = validateStep1(formValues) ?? validateStep2(formValues) ?? validateStep3(formValues);
      if (stepError) return stepError;

      const amountPaid = Number(dailyIncomeContext.registration?.amount ?? formValues.amountPaid ?? 0) || 0;
      if (getInvoiceFormBalance(formValues, amountPaid) < 0) {
        return t("invoices.wizard.validation.negativeBalance");
      }

      return null;
    },
    [dailyIncomeContext.registration?.amount, t, validateStep1, validateStep2, validateStep3],
  );

  const handleValuesChange = useCallback((next: InvoiceFormValues) => {
    setValues((current) => {
      const merged = {
        ...next,
        discount: current.discount,
        amountPaid: current.amountPaid,
      };
      valuesRef.current = merged;
      return merged;
    });
  }, []);

  const handleDailyIncomeContextChange = useCallback((context: InvoiceDailyIncomeContext) => {
    setDailyIncomeContext(context);
    setValues((current) => {
      const next = {
        ...current,
        amountPaid: String(context.registration?.amount ?? 0),
      };
      valuesRef.current = next;
      return next;
    });
  }, []);

  function handleDiscountChange(discount: string) {
    setValues((current) => {
      const next = { ...current, discount };
      valuesRef.current = next;
      return next;
    });
  }

  function clearErrors() {
    setStepError(null);
    setSubmitError(null);
  }

  async function handleNext() {
    const currentValues = valuesRef.current;
    const error =
      step === 1
        ? validateStep1(currentValues)
        : step === 2
          ? validateStep2(currentValues)
          : step === 3
            ? validateStep3(currentValues)
            : requireDailyIncomeRegistration && step === 4 && !canContinuePaymentStep
              ? t("invoices.wizard.validation.dailyIncomeContinueRequired")
              : null;
    if (error) {
      setStepError(error);
      return;
    }

    clearErrors();
    if (requireDailyIncomeRegistration && step === 3) {
      setDailyIncomeContext(emptyInvoiceDailyIncomeContext());
    }
    setStep((current) => (current + 1) as InvoiceWizardStep);
  }

  function handleBack() {
    clearErrors();
    setStep((current) => (current - 1) as InvoiceWizardStep);
  }

  function goToStep(target: InvoiceWizardStep) {
    clearErrors();
    setStep(target);
  }

  function handleSelectCompletedStep(target: InvoiceWizardStep) {
    if (target >= step) return;
    goToStep(target);
  }

  async function handlePrint() {
    if (!onPrint) return;

    const error = validateForSave(values);
    if (error) {
      setSubmitError(error);
      return;
    }

    clearErrors();
    const printError = await onPrint(values, savedInvoiceId);
    if (printError) {
      setSubmitError(printError);
    }
  }

  async function handleSave() {
    const error =
      validateForSave(values) ??
      (requireDailyIncomeRegistration && !canContinuePaymentStep
        ? t("invoices.wizard.validation.dailyIncomeSaveRequired")
        : null);
    if (error) {
      setSubmitError(error);
      return;
    }

    const result = await onSubmit(
      {
        ...values,
        amountPaid: String(dailyIncomeContext.registration?.amount ?? values.amountPaid ?? 0),
      },
      toInvoiceFormSubmitContext(dailyIncomeContext),
    );
    if (result.error) {
      setSubmitError(result.error);
      setStepError(null);
      return;
    }

    setSubmitError(null);
    setStepError(null);

    if (result.savedInvoiceId) {
      setSavedInvoiceId(result.savedInvoiceId);
    }

    onSaved?.();

    if (!resetAfterSave) return;

    setStep(1);
    const nextValues = resetInvoiceFormForNextEntry(values);
    setValues(nextValues);
    valuesRef.current = nextValues;
    setFormSessionKey((key) => key + 1);
    setSavedInvoiceId(null);
    setDailyIncomeContext(emptyInvoiceDailyIncomeContext());
  }

  const saveAmountPaid = Number(dailyIncomeContext.registration?.amount ?? values.amountPaid ?? 0) || 0;
  const hasNegativeBalance = getInvoiceFormBalance(values, saveAmountPaid) < 0;
  const negativeBalanceError = hasNegativeBalance ? t("invoices.wizard.validation.negativeBalance") : null;
  const saveDisabled = isSubmitting || hasNegativeBalance;
  const bannerError =
    step === previewStep ? submitError ?? negativeBalanceError ?? externalError : stepError ?? externalError;
  const invoiceDate = values.date.trim().slice(0, 10);
  const invoiceBranchId = currentUserQuery.data?.branch?.id ?? 0;
  const showOpenDailyIncomeAction =
    Boolean(bannerError) &&
    isMissingOpenIncomeStatementError(bannerError) &&
    Boolean(invoiceDate) &&
    invoiceBranchId > 0;

  function openDailyIncomeForInvoiceDate() {
    if (!invoiceDate || invoiceBranchId <= 0) return;
    window.open(
      buildDailyIncomeWorkspaceHref({
        date: invoiceDate,
        branchId: invoiceBranchId,
        create: true,
      }),
      "_blank",
      "noopener,noreferrer",
    );
  }

  const bannerErrorAction = showOpenDailyIncomeAction ? (
    <div className="space-y-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-destructive/40 bg-background text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={openDailyIncomeForInvoiceDate}
      >
        <ExternalLink className="size-4" />
        {t("invoices.wizard.dailyIncome.openForInvoiceDate")}
      </Button>
      <p className="text-xs leading-snug text-destructive/80">
        {t("invoices.wizard.dailyIncome.openForInvoiceDateHint")}
      </p>
    </div>
  ) : undefined;
  const showPrint = allowPrint && Boolean(onPrint);
  const summaryDiscountChange =
    requireDailyIncomeRegistration && dailyIncomeContext.registration
      ? undefined
      : handleDiscountChange;

  const stepLabelKey =
    !requireDailyIncomeRegistration && step === 4
      ? "invoices.wizard.steps.preview"
      : getInvoiceWizardStepLabelKey(step);
  const stepTitleKey =
    !requireDailyIncomeRegistration && step === 4
      ? "invoices.wizard.stepTitles.reviewAndSave"
      : getInvoiceWizardStepTitleKey(step);

  const formStep = (
    <InvoiceForm
      key={`invoice-wizard-form-${formSessionKey}`}
      appearance={isMobileLayout ? "phoneWizard" : "wizard"}
      wizardStep={(step <= 3 ? step : 3) as InvoiceWizardFormStep}
      wizardTotalSteps={previewStep}
      showFooter={false}
      initialValues={values}
      submitLabel={submitLabel}
      onSubmit={() => ({ error: null })}
      onValuesChange={handleValuesChange}
      onContinue={handleNext}
      onCancel={onCancel}
    />
  );

  const paymentStep = (
    <InvoiceDailyIncomeStep
      values={values}
      onContextChange={handleDailyIncomeContextChange}
    />
  );

  const previewContent = (
    <InvoiceFormPreviewStep
      values={values}
      appearance={isMobileLayout ? "phoneWizard" : "wizard"}
      onEditStep={goToStep}
      showPaymentSection={requireDailyIncomeRegistration}
      paymentSummary={
        requireDailyIncomeRegistration
          ? {
              registration: dailyIncomeContext.registration,
              incomeStatementId: dailyIncomeContext.incomeStatementId,
              paymentSkipped: dailyIncomeContext.paymentSkipped,
            }
          : undefined
      }
      onEditPayment={requireDailyIncomeRegistration ? () => setStep(4) : undefined}
    />
  );

  const backButton =
    step > 1 ? (
      <Button type="button" variant="outline" onClick={handleBack}>
        <ArrowLeft className="size-4" />
        {t("invoices.wizard.actions.back")}
      </Button>
    ) : null;

  const nextOrSaveButton =
    step < previewStep ? (
      <Button type="button" className="max-sm:px-3" onClick={handleNext}>
        {t("common.actions.next")}
        <ArrowRight className="size-4" />
      </Button>
    ) : (
      <>
        {showPrint ? (
          <Button
            type="button"
            variant="outline"
            className="max-sm:px-3"
            onClick={handlePrint}
            disabled={isPrinting}
          >
            <Printer className="size-4" />
            {isPrinting ? t("invoices.wizard.actions.preparing") : t("invoices.wizard.actions.print")}
          </Button>
        ) : null}
        <Button type="button" className="max-sm:px-3" onClick={handleSave} disabled={saveDisabled}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {isSubmitting ? t("common.actions.saving") : submitLabel}
        </Button>
      </>
    );

  if (isMobileLayout) {
    const steps = requireDailyIncomeRegistration
      ? INVOICE_WIZARD_STEP_ORDER
      : ([1, 2, 3, 4] as const);
    const currentStepIndex = Math.max(
      steps.findIndex((entry) => entry === step),
      0,
    );
    const phoneTitle =
      step === previewStep
        ? t("invoices.wizard.steps.preview")
        : t(stepLabelKey);
    const phoneStepText = `${currentStepIndex + 1} of ${steps.length}`;
    const phoneBackLabel =
      step > 1 ? t("invoices.wizard.actions.back") : t("common.actions.cancel");
    const phonePrimary =
      step < previewStep ? (
        <Button type="button" className="h-12 rounded-xl px-4 text-base" onClick={handleNext}>
          {t("common.actions.next")}
          <ArrowRight className="size-4" />
        </Button>
      ) : showPrint ? (
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 rounded-xl text-muted-foreground"
            onClick={handlePrint}
            disabled={isPrinting}
            aria-label={isPrinting ? t("invoices.wizard.actions.preparing") : t("invoices.wizard.actions.print")}
          >
            {isPrinting ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
          </Button>
          <Button type="button" className="h-12 rounded-xl px-4 text-base" onClick={handleSave} disabled={saveDisabled}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isSubmitting ? t("common.actions.saving") : submitLabel}
          </Button>
        </div>
      ) : (
        <Button type="button" className="h-12 rounded-xl px-4 text-base" onClick={handleSave} disabled={saveDisabled}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {isSubmitting ? t("common.actions.saving") : submitLabel}
        </Button>
      );
    const phoneBackControl = (
      <Button
        type="button"
        variant="outline"
        className="h-12 rounded-xl px-4 text-base"
        onClick={step > 1 ? handleBack : onCancel}
      >
        {step > 1 ? <ArrowLeft className="size-4" /> : null}
        {phoneBackLabel}
      </Button>
    );

    return (
      <div
        data-testid="invoice-form-wizard"
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background",
          invoiceWizardTypographyRoot,
        )}
      >
        <div
          data-print-hide
          className="shrink-0 border-b-4 border-primary/30 bg-primary px-4 py-4 text-primary-foreground"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="min-w-0 truncate text-lg font-semibold">
              {phoneTitle}
            </p>
            <div className="flex shrink-0 items-center gap-3">
              <p className="text-sm font-semibold">{phoneStepText}</p>
              <Button
                type="button"
                variant="ghost"
                className="h-8 px-2 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                onClick={onCancel}
              >
                {t("common.actions.cancel")}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {bannerError ? (
            <InvoiceWizardNotice tone="error" message={bannerError} action={bannerErrorAction} />
          ) : null}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {step <= 3 ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{formStep}</div>
            ) : requireDailyIncomeRegistration && step === 4 ? (
              <div className="h-full min-w-0 overflow-x-hidden overflow-y-auto px-4 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
                {paymentStep}
              </div>
            ) : (
              <div className="h-full min-w-0 overflow-x-hidden overflow-y-auto px-4 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
                {previewContent}
              </div>
            )}
          </div>
        </div>

        {step >= 3 ? (
          <InvoiceWizardSummaryMobileBar
            values={values}
            onDiscountChange={summaryDiscountChange}
            showPayment={requireDailyIncomeRegistration}
            className="shrink-0 border-t border-border/70 bg-card px-3 py-2"
          />
        ) : null}

        <div
          data-print-hide
          className="grid shrink-0 grid-cols-2 gap-3 border-t border-border bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
          {phoneBackControl}
          {phonePrimary}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="invoice-form-wizard"
      className={cn("flex min-h-0 flex-1 flex-col", invoiceWizardTypographyRoot)}
    >
      <div data-print-hide>
        <InvoiceWizardStepper
          step={step}
          includePaymentStep={requireDailyIncomeRegistration}
          onSelectStep={handleSelectCompletedStep}
        />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card">
          <div
            data-print-hide
            className="shrink-0 space-y-1 border-b border-border px-4 py-3 sm:px-8 sm:py-4"
          >
            <p className={cn(invoiceStepEyebrowClassName, "hidden sm:block")}>
              {t("invoices.wizard.stepEyebrow", {
                step,
                total: previewStep,
                label: t(stepLabelKey),
              })}
            </p>
            <h2 className={invoiceStepTitleClassName}>{t(stepTitleKey)}</h2>
          </div>

          {bannerError ? (
            <InvoiceWizardNotice tone="error" message={bannerError} action={bannerErrorAction} />
          ) : null}

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden",
                step > 3 && "pointer-events-none invisible absolute inset-0",
              )}
              aria-hidden={step > 3}
            >
              {formStep}
            </div>
            {requireDailyIncomeRegistration && step === 4 ? (
              <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-12">
                {paymentStep}
              </div>
            ) : step === previewStep ? (
              <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))] sm:pb-12">
                {previewContent}
              </div>
            ) : null}
          </div>

          <InvoiceWizardSummaryMobileBar
            values={values}
            onDiscountChange={summaryDiscountChange}
            showPayment={requireDailyIncomeRegistration}
          />
        </div>

        <InvoiceWizardSummarySidebar
          values={values}
          onDiscountChange={summaryDiscountChange}
          showPayment={requireDailyIncomeRegistration}
        />
      </div>

      <div
        data-print-hide
        className="shrink-0 border-t border-border bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-8 sm:pb-3"
      >
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {backButton ?? <span className="flex-1" aria-hidden />}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" className="max-sm:px-3" onClick={onCancel}>
              {t("common.actions.cancel")}
            </Button>
            {nextOrSaveButton}
          </div>
        </div>
      </div>
    </div>
  );
}
