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
import type { DailyIncomeJournal } from "@/lib/accounting/daily-income/types";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
import { customerHasUnverifiedPrimaryAddress } from "@/lib/customers/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
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
  /** New invoices must be registered in Daily Income before the final review. */
  requireDailyIncomeRegistration?: boolean;
  onSubmit: (values: InvoiceFormValues) => InvoiceFormSubmitResult | Promise<InvoiceFormSubmitResult>;
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
  const [step, setStep] = useState<InvoiceWizardStep>(1);
  const [values, setValues] = useState<InvoiceFormValues>(
    initialValues ?? createEmptyInvoiceForm(),
  );
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [formSessionKey, setFormSessionKey] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const valuesRef = useRef(values);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dailyIncomeRegistration, setDailyIncomeRegistration] =
    useState<DailyIncomeJournal | null>(null);
  const previewStep: InvoiceWizardStep = requireDailyIncomeRegistration ? 5 : 4;

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

  const handleDailyIncomeRegistrationChange = useCallback(
    (registration: DailyIncomeJournal | null) => {
      setDailyIncomeRegistration(registration);
      setValues((current) => {
        const next = {
          ...current,
          amountPaid: String(registration?.amount ?? 0),
        };
        valuesRef.current = next;
        return next;
      });
    },
    [],
  );

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

  function handleNext() {
    const currentValues = valuesRef.current;
    const error =
      step === 1
        ? validateStep1(currentValues)
        : step === 2
          ? validateStep2(currentValues)
          : step === 3
            ? validateStep3(currentValues)
            : requireDailyIncomeRegistration && step === 4 && !dailyIncomeRegistration
              ? t("invoices.wizard.validation.dailyIncomeContinueRequired")
              : null;
    if (error) {
      setStepError(error);
      return;
    }

    clearErrors();
    if (requireDailyIncomeRegistration && step === 3) {
      setDailyIncomeRegistration(null);
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
      (requireDailyIncomeRegistration && !dailyIncomeRegistration
        ? t("invoices.wizard.validation.dailyIncomeSaveRequired")
        : null);
    if (error) {
      setSubmitError(error);
      return;
    }

    const result = await onSubmit(values);
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
    setDailyIncomeRegistration(null);
  }

  const previewError = submitError ?? externalError;
  const footerError = step === previewStep ? null : stepError ?? externalError;
  const showUnverifiedSenderWarning =
    isGoogleMapsConfigured() &&
    Boolean(values.sender && customerHasUnverifiedPrimaryAddress(values.sender));
  const footerWarning =
    showUnverifiedSenderWarning && (step === 2 || step === previewStep)
      ? t("invoices.wizard.validation.unverifiedSenderAddress")
      : null;
  const showPrint = allowPrint && Boolean(onPrint);
  const summaryDiscountChange =
    requireDailyIncomeRegistration && dailyIncomeRegistration
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
            className="shrink-0 space-y-1 border-b border-border px-5 py-4 sm:px-8"
          >
            <p className={invoiceStepEyebrowClassName}>
              {t("invoices.wizard.stepEyebrow", {
                step,
                total: previewStep,
                label: t(stepLabelKey),
              })}
            </p>
            <h2 className={invoiceStepTitleClassName}>{t(stepTitleKey)}</h2>
          </div>

          {footerError ? (
            <InvoiceWizardNotice tone="error" message={footerError} />
          ) : footerWarning ? (
            <InvoiceWizardNotice tone="warning" message={footerWarning} />
          ) : null}

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden",
                step > 3 && "pointer-events-none invisible absolute inset-0",
              )}
              aria-hidden={step > 3}
            >
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
            </div>
            {requireDailyIncomeRegistration && step === 4 ? (
              <div className="min-h-0 flex-1 overflow-y-auto pb-10 sm:pb-12">
                <InvoiceDailyIncomeStep
                  values={values}
                  onRegistrationChange={handleDailyIncomeRegistrationChange}
                />
              </div>
            ) : step === previewStep ? (
              <div className="min-h-0 flex-1 overflow-y-auto pb-10 sm:pb-12">
                <InvoiceFormPreviewStep
                  values={values}
                  appearance="wizard"
                  onEditStep={goToStep}
                  showPaymentSection={requireDailyIncomeRegistration}
                  onEditPayment={requireDailyIncomeRegistration ? () => setStep(4) : undefined}
                  errorMessage={previewError}
                />
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
        className="shrink-0 border-t border-border bg-card px-5 py-3 sm:px-8"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {step > 1 ? (
              <Button type="button" variant="outline" onClick={handleBack}>
                <ArrowLeft className="size-4" />
                {t("invoices.wizard.actions.back")}
              </Button>
            ) : (
              <span className="flex-1" aria-hidden />
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("common.actions.cancel")}
            </Button>
            {step < previewStep ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={requireDailyIncomeRegistration && step === 4 && !dailyIncomeRegistration}
              >
                {t("common.actions.next")}
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <>
                {showPrint ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrint}
                    disabled={isPrinting}
                  >
                    <Printer className="size-4" />
                    {isPrinting ? t("invoices.wizard.actions.preparing") : t("invoices.wizard.actions.print")}
                  </Button>
                ) : null}
                <Button type="button" onClick={handleSave} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {isSubmitting ? t("common.actions.saving") : submitLabel}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
