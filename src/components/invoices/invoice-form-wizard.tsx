"use client";

import { ArrowLeft, ArrowRight, Printer, Save } from "lucide-react";
import { useCallback, useState } from "react";

import { InvoiceForm } from "@/components/invoices/invoice-form";
import { InvoiceDailyIncomeStep } from "@/components/invoices/invoice-daily-income-step";
import { InvoiceFormPreviewStep } from "@/components/invoices/invoice-form-preview-step";
import { InvoiceWizardNotice } from "@/components/invoices/invoice-wizard-notice";
import {
  InvoiceWizardSummaryMobileBar,
  InvoiceWizardSummarySidebar,
} from "@/components/invoices/invoice-wizard-summary-panel";
import {
  INVOICE_WIZARD_STEP_TITLES,
  INVOICE_WIZARD_STEPS,
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
import { cn } from "@/lib/utils";
import {
  createEmptyInvoiceForm,
  resetInvoiceFormForNextEntry,
  resolveLineTotal,
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

const UNVERIFIED_SENDER_MESSAGE =
  "Verify the sender's address before saving. Open the sender and update it with a Google-suggested address.";

function validateStep1(values: InvoiceFormValues): string | null {
  if (!values.date.trim()) return "Date is required.";
  if (!values.invoiceNumber.trim()) return "Invoice number is required.";
  if (!values.containerId) return "Container is required.";
  if (!values.paymentLocation) return "Pending payment location is required.";
  return null;
}

function validateStep2(values: InvoiceFormValues): string | null {
  if (!values.sender) return "Sender is required.";
  if (
    isGoogleMapsConfigured() &&
    values.sender &&
    customerHasUnverifiedPrimaryAddress(values.sender)
  ) {
    return UNVERIFIED_SENDER_MESSAGE;
  }
  return null;
}

function validateStep3(values: InvoiceFormValues): string | null {
  const hasContent = values.lineItems.some(
    (item) => item.itemName.trim() || item.itemId || resolveLineTotal(item) > 0,
  );
  if (!hasContent) return "Add at least one line item.";
  return null;
}

function validateForSave(values: InvoiceFormValues): string | null {
  return validateStep1(values) ?? validateStep2(values) ?? validateStep3(values);
}

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
  const [step, setStep] = useState<InvoiceWizardStep>(1);
  const [values, setValues] = useState<InvoiceFormValues>(
    initialValues ?? createEmptyInvoiceForm(),
  );
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [formSessionKey, setFormSessionKey] = useState(0);
  const [formSeed, setFormSeed] = useState<InvoiceFormValues>(
    initialValues ?? createEmptyInvoiceForm(),
  );
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dailyIncomeRegistration, setDailyIncomeRegistration] =
    useState<DailyIncomeJournal | null>(null);
  const previewStep: InvoiceWizardStep = requireDailyIncomeRegistration ? 5 : 4;

  const handleValuesChange = useCallback((next: InvoiceFormValues) => {
    setValues((current) => ({
      ...next,
      discount: current.discount,
    }));
  }, []);

  const handleDailyIncomeRegistrationChange = useCallback(
    (registration: DailyIncomeJournal | null) => {
      setDailyIncomeRegistration(registration);
      setValues((current) => ({
        ...current,
        amountPaid: String(registration?.amount ?? 0),
      }));
    },
    [],
  );

  function handleDiscountChange(discount: string) {
    setValues((current) => ({ ...current, discount }));
  }

  function clearErrors() {
    setStepError(null);
    setSubmitError(null);
  }

  function handleNext() {
    const error =
      step === 1
        ? validateStep1(values)
        : step === 2
          ? validateStep2(values)
          : step === 3
            ? validateStep3(values)
            : requireDailyIncomeRegistration && step === 4 && !dailyIncomeRegistration
              ? "Register this invoice in Daily Income before continuing."
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
    if (step >= 4) {
      setFormSeed(values);
    }
    clearErrors();
    setStep((current) => (current - 1) as InvoiceWizardStep);
  }

  function goToStep(target: InvoiceWizardFormStep) {
    if (step >= 4) {
      setFormSeed(values);
    }
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
        ? "Register this invoice in Daily Income before saving."
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
    setFormSeed(nextValues);
    setFormSessionKey((key) => key + 1);
    setSavedInvoiceId(null);
    setDailyIncomeRegistration(null);
  }

  const previewError = submitError ?? externalError;
  const footerError = step === previewStep ? null : stepError ?? externalError;
  const blockForUnverifiedParty =
    isGoogleMapsConfigured() &&
    Boolean(values.sender && customerHasUnverifiedPrimaryAddress(values.sender));
  const footerWarning =
    step === previewStep && blockForUnverifiedParty ? UNVERIFIED_SENDER_MESSAGE : null;
  const showPrint = allowPrint && Boolean(onPrint);
  const summaryDiscountChange =
    requireDailyIncomeRegistration && dailyIncomeRegistration
      ? undefined
      : handleDiscountChange;

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
              Step {step} of {previewStep} · {requireDailyIncomeRegistration
                ? INVOICE_WIZARD_STEPS[step - 1]?.label
                : step === 4
                  ? "Preview"
                  : INVOICE_WIZARD_STEPS[step - 1]?.label}
            </p>
            <h2 className={invoiceStepTitleClassName}>
              {!requireDailyIncomeRegistration && step === 4
                ? "Review & save invoice"
                : INVOICE_WIZARD_STEP_TITLES[step]}
            </h2>
          </div>

          {footerError ? (
            <InvoiceWizardNotice tone="error" message={footerError} />
          ) : footerWarning ? (
            <InvoiceWizardNotice tone="warning" message={footerWarning} />
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {step <= 3 ? (
              <InvoiceForm
                key={`invoice-wizard-form-${formSessionKey}`}
                appearance="wizard"
                wizardStep={step as InvoiceWizardFormStep}
                showFooter={false}
                initialValues={formSeed}
                suggestedInvoiceNumber={suggestedInvoiceNumber}
                submitLabel={submitLabel}
                onSubmit={() => ({ error: null })}
                onValuesChange={handleValuesChange}
                onCancel={onCancel}
              />
            ) : requireDailyIncomeRegistration && step === 4 ? (
              <div className="min-h-0 flex-1 overflow-y-auto pb-10 sm:pb-12">
                <InvoiceDailyIncomeStep
                  values={values}
                  onRegistrationChange={handleDailyIncomeRegistrationChange}
                />
              </div>
            ) : (
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
            )}
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
                Back
              </Button>
            ) : (
              <span className="flex-1" aria-hidden />
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            {step < previewStep ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={requireDailyIncomeRegistration && step === 4 && !dailyIncomeRegistration}
              >
                Next
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
                    {isPrinting ? "Preparing…" : "Print"}
                  </Button>
                ) : null}
                <Button type="button" onClick={handleSave} disabled={blockForUnverifiedParty || isSubmitting}>
                  <Save className="size-4" />
                  {isSubmitting ? "Saving…" : submitLabel}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
