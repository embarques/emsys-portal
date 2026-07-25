"use client";

import { ArrowLeft, ArrowRight, Loader2, Printer, Save } from "lucide-react";
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
} from "@/components/invoices/invoice-wizard-stepper";
import {
  invoiceStepEyebrowClassName,
  invoiceStepTitleClassName,
  invoiceWizardTypographyRoot,
} from "@/components/invoices/invoice-wizard-typography";
import { Button } from "@/components/ui/button";
import { useIsMobileViewport } from "@/hooks/use-is-mobile-viewport";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
import { customerHasUnverifiedPrimaryAddress } from "@/lib/customers/types";
import { useTranslation } from "@/lib/i18n";
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
  isInvoiceEmployeePickupSource,
  resetInvoiceFormForNextEntry,
  hasInvoiceLineItemContent,
  type InvoiceFormSubmitResult,
  type InvoiceFormValues,
} from "@/lib/invoices/types";

type Props = {
  initialValues?: InvoiceFormValues;
  suggestedInvoiceNumber?: string;
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
  suggestedInvoiceNumber,
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
      return validateStep1(formValues) ?? validateStep2(formValues) ?? validateStep3(formValues);
    },
    [validateStep1, validateStep2, validateStep3],
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

  function goToStep(target: InvoiceWizardFormStep) {
    clearErrors();
    setStep(target);
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
    const nextValues = resetInvoiceFormForNextEntry(
      values,
      result.nextInvoiceNumber ?? suggestedInvoiceNumber ?? "",
    );
    setValues(nextValues);
    valuesRef.current = nextValues;
    setFormSessionKey((key) => key + 1);
    setSavedInvoiceId(null);
    setDailyIncomeContext(emptyInvoiceDailyIncomeContext());
  }

  const bannerError =
    step === previewStep ? submitError ?? externalError : stepError ?? externalError;
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
      appearance="wizard"
      wizardStep={(step <= 3 ? step : 3) as InvoiceWizardFormStep}
      showFooter={false}
      initialValues={initialValues ?? createEmptyInvoiceForm()}
      suggestedInvoiceNumber={suggestedInvoiceNumber}
      submitLabel={submitLabel}
      onSubmit={() => ({ error: null })}
      onValuesChange={handleValuesChange}
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
      appearance="wizard"
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
        <Button type="button" className="max-sm:px-3" onClick={handleSave} disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {isSubmitting ? t("common.actions.saving") : submitLabel}
        </Button>
      </>
    );

  if (isMobileLayout) {
    return (
      <div
        data-testid="invoice-form-wizard"
        className={cn(
          "flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-x-hidden bg-card",
          invoiceWizardTypographyRoot,
        )}
      >
        <div data-print-hide>
          <InvoiceWizardStepper step={step} includePaymentStep={requireDailyIncomeRegistration} />
        </div>

        <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden overflow-x-hidden">
          <div data-print-hide className="shrink-0 border-b border-border px-4 py-3">
            <h2 className="font-[family-name:var(--font-invoice-display)] text-lg font-extrabold uppercase tracking-wide text-foreground">
              {t(stepTitleKey)}
            </h2>
          </div>

          {bannerError ? <InvoiceWizardNotice tone="error" message={bannerError} /> : null}

          <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden overflow-x-hidden">
            {step <= 3 ? (
              <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col overflow-hidden overflow-x-hidden">
                {formStep}
              </div>
            ) : requireDailyIncomeRegistration && step === 4 ? (
              <div className="h-full max-w-full overflow-x-hidden overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))]">
                {paymentStep}
              </div>
            ) : (
              <div className="h-full max-w-full overflow-x-hidden overflow-y-auto pb-[calc(6rem+env(safe-area-inset-bottom))]">
                {previewContent}
              </div>
            )}
          </div>
        </div>

        <InvoiceWizardSummaryMobileBar
          values={values}
          onDiscountChange={summaryDiscountChange}
          showPayment={requireDailyIncomeRegistration}
          className="px-3 py-2"
        />

        <div
          data-print-hide
          className="shrink-0 border-t border-border bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
          {step > 1 ? (
            <div className="grid grid-cols-2 gap-2">
              {backButton}
              {nextOrSaveButton}
            </div>
          ) : (
            <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                {t("common.actions.cancel")}
              </Button>
              {nextOrSaveButton}
            </div>
          )}
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
        <InvoiceWizardStepper step={step} includePaymentStep={requireDailyIncomeRegistration} />
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

          {bannerError ? <InvoiceWizardNotice tone="error" message={bannerError} /> : null}

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
