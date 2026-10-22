"use client";

import { ArrowLeft, ArrowRight, ExternalLink, Loader2, Printer, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { InvoiceDocumentsSection } from "@/components/invoices/invoice-documents-section";
import { InvoiceDocumentPicker } from "@/components/invoices/invoice-document-picker";
import { useInvoiceDocumentDraft } from "@/lib/invoices/hooks/use-invoice-document-draft";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { InvoiceDailyIncomeStep } from "@/components/invoices/invoice-daily-income-step";
import { InvoiceFormPreviewStep } from "@/components/invoices/invoice-form-preview-step";
import {
  InvoicePoliciesStep,
  type InvoicePoliciesAgreementState,
} from "@/components/invoices/invoice-policies-step";
import { focusInvoiceWizardField } from "@/components/invoices/invoice-wizard-focus";
import { InvoiceWizardNotice } from "@/components/invoices/invoice-wizard-notice";
import {
  InvoiceWizardSummaryMobileBar,
  InvoiceWizardSummarySidebar,
} from "@/components/invoices/invoice-wizard-summary-panel";
import {
  getInvoiceWizardStepKind,
  getInvoiceWizardStepLabelKey,
  getInvoiceWizardStepTitleKey,
  InvoiceWizardStepper,
  resolveInvoiceWizardLayout,
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
import { getNavigableFormFields } from "@/hooks/use-form-enter-navigation";
import { useWorkspaceTabQueriesEnabled } from "@/lib/layout/workspace-tab-scope";
import { buildDailyIncomeWorkspaceHref } from "@/lib/accounting/daily-income/workspace-href";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useActiveInvoicePolicies } from "@/lib/invoice-policies/hooks/use-invoice-policies";
import { buildCustomerSignature } from "@/lib/invoices/schemas/customer-signature.schema";
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
  findInvoiceWizardPaymentIssue,
  findInvoiceWizardPoliciesIssue,
  findInvoiceWizardSaveIssue,
  findInvoiceWizardStep1Issue,
  findInvoiceWizardStep2Issue,
  findInvoiceWizardStep3Issue,
  INVOICE_WIZARD_FIELDS,
  type InvoiceWizardIssue,
} from "@/lib/invoices/invoice-wizard-validation";
import {
  createEmptyInvoiceForm,
  getInvoiceFormBalance,
  resetInvoiceFormForNextEntry,
  resolveLineTotal,
  type InvoiceFormSubmitResult,
  type InvoiceFormValues,
} from "@/lib/invoices/types";

const EMPTY_POLICIES_AGREEMENT: InvoicePoliciesAgreementState = {
  agreed: false,
  skipSignature: true,
  signatureDataUrl: null,
};

type Props = {
  initialValues?: InvoiceFormValues;
  submitLabel: string;
  externalError?: string | null;
  /**
   * True when editing a persisted invoice. Create always pre-fills a client
   * `invoiceId`, so callers must not use truthy `invoiceId` to detect edit mode.
   */
  isEditing?: boolean;
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
  /**
   * Include signature capture on create and agreement when active policies exist.
   * Edit flows leave this false.
   */
  requirePolicySignature?: boolean;
  /** Open on this wizard step. Defaults to 1. */
  initialWizardStep?: number;
  /** Open the matching line item in edit mode when landing on step 3. */
  requestEditLineItemId?: string | null;
  onSubmit: (
    values: InvoiceFormValues,
    context?: InvoiceFormSubmitContext,
  ) => InvoiceFormSubmitResult | Promise<InvoiceFormSubmitResult>;
  onSaved?: () => void;
  onPrint?: (values: InvoiceFormValues, savedInvoiceId?: string | null) => Promise<string | null>;
  isPrinting?: boolean;
  onCancel: () => void;
};

function resolveInitialWizardStep(
  step: number | undefined,
  maxStep: InvoiceWizardStep,
): InvoiceWizardStep {
  if (step == null || !Number.isFinite(step)) return 1;
  const clamped = Math.min(Math.max(Math.trunc(step), 1), maxStep);
  return clamped as InvoiceWizardStep;
}

export function InvoiceFormWizard({
  initialValues,
  submitLabel,
  externalError = null,
  isEditing = false,
  allowPrint = false,
  isSubmitting = false,
  resetAfterSave = true,
  requireDailyIncomeRegistration = false,
  requirePolicySignature = false,
  initialWizardStep,
  requestEditLineItemId = null,
  onSubmit,
  onSaved,
  onPrint,
  isPrinting = false,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const canUseManualNumber = hasPermission(
    PERMISSIONS.invoicesManualNumber.name,
    PERMISSIONS.invoicesManualNumber.resourceType,
  );
  const isMobileLayout = useIsMobileViewport();
  const currentUserQuery = useCurrentUser();
  const activePoliciesQuery = useActiveInvoicePolicies(requirePolicySignature);
  const activePolicies = activePoliciesQuery.data ?? [];
  const policiesUnavailable = requirePolicySignature && !activePoliciesQuery.isSuccess;
  const includePolicies = requirePolicySignature && !isEditing;
  const canUploadDocuments = hasPermission("canUpdateInvoice", "invoice");
  const includeDocumentsStep = Boolean(isEditing && initialValues?.invoiceId) || canUploadDocuments;
  const layout = useMemo(
    () =>
      resolveInvoiceWizardLayout({
        requireDailyIncomeRegistration,
        includeDocumentsStep,
      }),
    [includeDocumentsStep, requireDailyIncomeRegistration],
  );
  const { previewStep, documentsStep: documentsStepId, paymentStep: paymentStepId } = layout;

  const [step, setStep] = useState<InvoiceWizardStep>(() =>
    resolveInitialWizardStep(initialWizardStep, layout.previewStep),
  );
  const [values, setValues] = useState<InvoiceFormValues>(
    initialValues && (!requireDailyIncomeRegistration || canUseManualNumber)
      ? initialValues
      : { ...(initialValues ?? createEmptyInvoiceForm()), autoGenerateNumber: true },
  );
  const documentDraft = useInvoiceDocumentDraft();
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[] | null>(null);
  const savingRef = useRef(false);
  const [preparingSave, setPreparingSave] = useState(false);
  const [documentStage, setDocumentStage] = useState(false);
  const [documentsBusy, setDocumentsBusy] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [formSessionKey, setFormSessionKey] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const valuesRef = useRef(values);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [focusFieldId, setFocusFieldId] = useState<string | null>(null);
  const [focusFieldKey, setFocusFieldKey] = useState(0);
  const [dailyIncomeContext, setDailyIncomeContext] = useState<InvoiceDailyIncomeContext>(
    emptyInvoiceDailyIncomeContext(),
  );
  const agreementForm = useForm<InvoicePoliciesAgreementState>({ defaultValues: EMPTY_POLICIES_AGREEMENT });
  const agreementValues = useWatch({ control: agreementForm.control });
  const policiesAgreement = useMemo<InvoicePoliciesAgreementState>(() => ({
    agreed: agreementValues.agreed ?? false,
    skipSignature: agreementValues.skipSignature ?? true,
    signatureDataUrl: agreementValues.signatureDataUrl ?? null,
  }), [agreementValues.agreed, agreementValues.skipSignature, agreementValues.signatureDataUrl]);
  const setPoliciesAgreement = agreementForm.reset;
  const wizardRef = useRef<HTMLDivElement>(null);
  const isTabActive = useWorkspaceTabQueriesEnabled();
  const stepKind = getInvoiceWizardStepKind(layout, step);

  useEffect(() => {
    if (step > previewStep) setStep(previewStep);
  }, [previewStep, step]);

  useEffect(() => {
    if (!isTabActive || isMobileLayout) return;
    const timeout = window.setTimeout(() => {
      const root = wizardRef.current;
      if (!root) return;
      const fields = getNavigableFormFields(root);
      if (focusFieldId && document.activeElement?.id === focusFieldId &&
        fields.includes(document.activeElement as HTMLElement)) return;
      const first = step === previewStep
        ? root.querySelector<HTMLElement>('[data-wizard-primary]')
        : fields[0] ?? root.querySelector<HTMLElement>('[data-wizard-primary]');
      first?.focus();
    }, 100);
    return () => window.clearTimeout(timeout);
  }, [step, previewStep, isTabActive, isMobileLayout, formSessionKey, focusFieldId]);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const previousReceiverIdRef = useRef(values.receiverId);

  const findStep1Issue = useCallback(
    (formValues: InvoiceFormValues) =>
      findInvoiceWizardStep1Issue(formValues, t, {
        includePaymentLocation: !requireDailyIncomeRegistration,
      }),
    [requireDailyIncomeRegistration, t],
  );
  const findStep2Issue = useCallback(
    (formValues: InvoiceFormValues) => findInvoiceWizardStep2Issue(formValues, t),
    [t],
  );
  const findStep3Issue = useCallback(
    (formValues: InvoiceFormValues) => findInvoiceWizardStep3Issue(formValues, t),
    [t],
  );

  useEffect(() => {
    const previousReceiverId = previousReceiverIdRef.current.trim();
    const nextReceiverId = values.receiverId.trim();
    previousReceiverIdRef.current = nextReceiverId;

    if (step !== 2) return;
    if (!nextReceiverId || !values.receiver || nextReceiverId === previousReceiverId) return;
    if (findStep2Issue(values)) return;

    setStepError(null);
    setSubmitError(null);
    setStep(3);
  }, [findStep2Issue, step, values]);

  const findSaveIssue = useCallback(
    (formValues: InvoiceFormValues) =>
      findInvoiceWizardSaveIssue({
        values: formValues,
        dailyIncome: dailyIncomeContext,
        requireDailyIncome: requireDailyIncomeRegistration,
        requirePolicySignature: includePolicies,
        policiesAgreement: { ...policiesAgreement, agreed: activePolicies.length === 0 || policiesAgreement.agreed },
        paymentStep: paymentStepId,
        previewStep,
        t,
      }),
    [
      dailyIncomeContext,
      activePolicies.length,
      includePolicies,
      paymentStepId,
      policiesAgreement,
      previewStep,
      requireDailyIncomeRegistration,
      t,
    ],
  );

  const handleValuesChange = useCallback((next: InvoiceFormValues) => {
    setValues((current) => {
      const merged = {
        ...next,
        ...(!canUseManualNumber && requireDailyIncomeRegistration ? { autoGenerateNumber: true } : {}),
        discount: current.discount,
        amountPaid: current.amountPaid,
      };
      valuesRef.current = merged;
      return merged;
    });
    setStepError(null);
  }, [canUseManualNumber, requireDailyIncomeRegistration]);

  const handleDailyIncomeContextChange = useCallback((context: InvoiceDailyIncomeContext) => {
    setDailyIncomeContext(context);
    if (requireDailyIncomeRegistration && canContinueInvoiceDailyIncomeStep(context)) {
      setStepError(null);
      setSubmitError(null);
    }
    setValues((current) => {
      const next = {
        ...current,
        ...(current.autoGenerateNumber && context.registration?.invoice?.number
          ? {
              invoiceNumber: context.registration.invoice.number,
              generatedInvoiceNumber: context.registration.invoice.number,
            }
          : {}),
        amountPaid: String(context.registration?.amount ?? 0),
      };
      valuesRef.current = next;
      return next;
    });
  }, [requireDailyIncomeRegistration]);

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

  function revealIssue(issue: InvoiceWizardIssue) {
    setStepError(issue.message);
    setSubmitError(issue.step === previewStep ? issue.message : null);
    setStep(issue.step);
    setFocusFieldId(issue.fieldId);
    setFocusFieldKey((key) => key + 1);
  }

  useEffect(() => {
    if (!focusFieldKey || !focusFieldId || focusFieldId === INVOICE_WIZARD_FIELDS.lineItems) return;
    const timeout = window.setTimeout(() => {
      focusInvoiceWizardField(focusFieldId);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [focusFieldId, focusFieldKey, step]);

  function findStepIssue(
    target: InvoiceWizardStep,
    currentValues: InvoiceFormValues,
    dailyIncome: InvoiceDailyIncomeContext = dailyIncomeContext,
  ): InvoiceWizardIssue | null {
    return target === 1
      ? findStep1Issue(currentValues)
      : target === 2
        ? findStep2Issue(currentValues)
        : target === 3
          ? findStep3Issue(currentValues)
          : paymentStepId != null && target === paymentStepId
            ? findInvoiceWizardPaymentIssue(
                dailyIncome,
                t,
                "continue",
                currentValues,
                paymentStepId,
              )
            : null;
  }

  function findCurrentStepIssue(
    currentValues: InvoiceFormValues,
    dailyIncome: InvoiceDailyIncomeContext = dailyIncomeContext,
  ): InvoiceWizardIssue | null {
    return findStepIssue(step, currentValues, dailyIncome);
  }

  function handleNext() {
    advanceStep(dailyIncomeContext);
  }

  /** Skip payment hands over its context before the wizard state has re-rendered. */
  function handleSkipDailyIncomePayment(context: InvoiceDailyIncomeContext) {
    setDailyIncomeContext(context);
    advanceStep(context);
  }

  function advanceStep(dailyIncome: InvoiceDailyIncomeContext) {
    if (savingRef.current || documentsBusy || isSubmitting || documentStage) return;
    const issue = findCurrentStepIssue(valuesRef.current, dailyIncome);
    if (issue) {
      revealIssue(issue);
      return;
    }

    clearErrors();
    if (requireDailyIncomeRegistration && step === 3) {
      setDailyIncomeContext(emptyInvoiceDailyIncomeContext());
    }
    setStep((current) => (current + 1) as InvoiceWizardStep);
  }

  function handleBack() {
    if (savingRef.current || documentsBusy || isSubmitting || documentStage) return;
    clearErrors();
    setStep((current) => (current - 1) as InvoiceWizardStep);
  }

  function goToStep(target: InvoiceWizardStep) {
    if (savingRef.current || documentsBusy || isSubmitting || documentStage) return;
    clearErrors();
    setStep(target);
  }

  /** Earlier steps open directly; later steps open once every step before them is valid. */
  function handleSelectStep(target: InvoiceWizardStep) {
    if (target === step) return;
    if (target < step) {
      goToStep(target);
      return;
    }
    if (savingRef.current || documentsBusy || isSubmitting || documentStage) return;

    const currentValues = valuesRef.current;
    for (const entry of layout.steps) {
      if (entry.id >= target) break;
      const issue = findStepIssue(entry.id, currentValues);
      if (issue) {
        revealIssue(issue);
        return;
      }
    }

    clearErrors();
    // Same as Next into the payment step: re-check Daily Income for the current invoice.
    if (requireDailyIncomeRegistration && target === paymentStepId && step < target) {
      setDailyIncomeContext(emptyInvoiceDailyIncomeContext());
    }
    setStep(target);
  }

  async function handlePrint() {
    if (!onPrint) return;

    const issue = findSaveIssue(values);
    if (issue) {
      revealIssue(issue);
      return;
    }

    clearErrors();
    const printError = await onPrint(values, savedInvoiceId);
    if (printError) {
      setSubmitError(printError);
    }
  }

  async function handleSave() {
    if (savingRef.current || isSubmitting || documentsBusy || documentStage || policiesUnavailable) return;
    const issue = findSaveIssue(values);
    if (issue) {
      revealIssue(issue);
      return;
    }

    savingRef.current = true;
    setPreparingSave(true);
    try {
      const submittedValues = {
        ...values,
        amountPaid: String(dailyIncomeContext.registration?.amount ?? values.amountPaid ?? 0),
      };
      const draftFiles = [...documentDraft.files];
      const customerSignature = !isEditing && includePolicies && !policiesAgreement.skipSignature && policiesAgreement.signatureDataUrl
        ? buildCustomerSignature(submittedValues.sender?.name ?? "", policiesAgreement.signatureDataUrl)
        : undefined;

      const result = await onSubmit(
        submittedValues,
        { ...toInvoiceFormSubmitContext(dailyIncomeContext), customerSignature },
      );
      if (result.error) {
        if (isMissingOpenIncomeStatementError(result.error) && paymentStepId != null) {
          revealIssue({
            step: paymentStepId,
            fieldId: INVOICE_WIZARD_FIELDS.dailyIncome,
            message: result.error,
          });
          return;
        }
        setSubmitError(result.error);
        setStepError(null);
        return;
      }

      setSubmitError(null);
      setStepError(null);

      if (result.deferClose) {
        return;
      }

      if (result.savedInvoiceId) {
        setSavedInvoiceId(result.savedInvoiceId);
      }

      if (!isEditing && result.savedInvoiceId && draftFiles.length) {
        setPendingUploadFiles(draftFiles);
        setDocumentsBusy(true);
        setDocumentStage(true);
        return;
      }
      finishSave();
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : t("invoices.wizard.validation.policiesSignatureRequired"));
    } finally {
      savingRef.current = false;
      setPreparingSave(false);
    }
  }

  function finishSave() {
    setDocumentsBusy(false);
    documentDraft.reset();
    setPendingUploadFiles(null);
    setDocumentStage(false);
    setPoliciesAgreement(EMPTY_POLICIES_AGREEMENT);
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
  const registeredCost = dailyIncomeContext.registration?.invoice?.cost ?? null;
  const lineSubtotal = values.lineItems.reduce((sum, item) => sum + resolveLineTotal(item), 0);
  const hasRegisteredCostMismatch =
    registeredCost != null &&
    Number.isFinite(registeredCost) &&
    Math.round(Math.abs(lineSubtotal - registeredCost) * 100) / 100 >= 0.01;
  const registeredCostMismatchError = hasRegisteredCostMismatch
    ? t("invoices.wizard.validation.registeredCostMismatch")
    : null;
  const policiesIssue =
    includePolicies && !policiesUnavailable
      ? findInvoiceWizardPoliciesIssue({ ...policiesAgreement, agreed: activePolicies.length === 0 || policiesAgreement.agreed }, t, previewStep)
      : null;
  const saveDisabled = preparingSave || isSubmitting || documentsBusy || documentStage || policiesUnavailable || Boolean(policiesIssue) || hasNegativeBalance || hasRegisteredCostMismatch;
  const bannerError =
    step === previewStep
      ? submitError ?? negativeBalanceError ?? registeredCostMismatchError ?? externalError
      : stepError ?? externalError;
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
  const currentStepWarning =
    step < previewStep
      ? findCurrentStepIssue(values)?.message ?? null
      : policiesIssue?.message ?? null;
  const footerNotice = bannerError ? (
    <InvoiceWizardNotice
      tone="error"
      variant="footer"
      message={bannerError}
      action={bannerErrorAction}
    />
  ) : currentStepWarning ? (
    <InvoiceWizardNotice tone="warning" variant="footer" message={currentStepWarning} />
  ) : null;
  const showPrint = allowPrint && Boolean(onPrint);
  const canApplyInvoiceDiscount = hasPermission(
    PERMISSIONS.invoicesApplyDiscount.name,
    PERMISSIONS.invoicesApplyDiscount.resourceType,
  );
  // Payments and discounts are posted on create (Cuadre) or from Daily Income.
  // Edit keeps the saved amounts and does not offer those actions.
  const allowDiscountEditing = requireDailyIncomeRegistration && canApplyInvoiceDiscount;
  const summaryDiscountChange =
    requireDailyIncomeRegistration && !dailyIncomeContext.registration
      ? handleDiscountChange
      : undefined;

  const stepLabelKey = getInvoiceWizardStepLabelKey(stepKind);
  const stepTitleKey = getInvoiceWizardStepTitleKey(stepKind);
  const stepHintKey =
    stepKind === "preview"
      ? "invoices.form.design.reviewHint"
      : stepKind === "payment"
        ? "invoices.form.design.paymentHint"
        : stepKind === "documents"
          ? "invoices.documents.formats"
          : null;

  const formStep = (
    <InvoiceForm
      key={`invoice-wizard-form-${formSessionKey}`}
      appearance={isMobileLayout ? "phoneWizard" : "wizard"}
      wizardStep={(step <= 3 ? step : 3) as InvoiceWizardFormStep}
      wizardTotalSteps={previewStep}
      showFooter={false}
      showPaymentLocation={!requireDailyIncomeRegistration}
      initialValues={values}
      submitLabel={submitLabel}
      onSubmit={() => ({ error: null })}
      onValuesChange={handleValuesChange}
      onContinue={handleNext}
      onCancel={onCancel}
      focusFieldId={focusFieldId}
      focusFieldKey={focusFieldKey}
      requestEditLineItemId={step === 3 ? requestEditLineItemId : null}
      defaultToLatestContainer={!isEditing}
    />
  );

  const paymentStepContent = (
    <InvoiceDailyIncomeStep
      values={values}
      onContextChange={handleDailyIncomeContextChange}
      onSkipPayment={handleSkipDailyIncomePayment}
      onPaymentLocationChange={(paymentLocation) => {
        setValues((current) => {
          const next = { ...current, paymentLocation };
          valuesRef.current = next;
          return next;
        });
        setStepError(null);
        setSubmitError(null);
      }}
    />
  );

  const policiesSectionNumber = requireDailyIncomeRegistration ? 6 : 5;
  const policiesReviewSection = !includePolicies ? null : policiesUnavailable ? (
    <div className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      {activePoliciesQuery.isError ? (
        <>
          <p role="alert" className="text-sm text-destructive">
            {t("invoices.wizard.policies.loadError")}
          </p>
          <Button type="button" variant="outline" disabled={activePoliciesQuery.isFetching} onClick={() => void activePoliciesQuery.refetch()}>
            {t("invoicePolicies.retry")}
          </Button>
        </>
      ) : <p role="status" className="text-sm text-muted-foreground">{t("common.loading")}</p>}
    </div>
  ) : (
    <InvoicePoliciesStep
      number={policiesSectionNumber}
      variant={isMobileLayout ? "phonePanel" : "default"}
      policies={activePolicies}
      value={policiesAgreement}
      onChange={(next) => {
        setPoliciesAgreement(next);
        setStepError(null);
        setSubmitError(null);
      }}
      disabled={isSubmitting || documentsBusy || documentStage || preparingSave}
      className="print:hidden"
    />
  );

  const documentsBody = isEditing && initialValues?.invoiceId ? (
    <div className="rounded-lg border p-3 sm:p-4">
      <InvoiceDocumentsSection
        compact
        invoice={initialValues}
        onBusyChange={setDocumentsBusy}
      />
    </div>
  ) : canUploadDocuments ? (
    <InvoiceDocumentPicker
      files={documentDraft.files}
      invalid={documentDraft.invalid}
      disabled={isSubmitting || documentsBusy}
      onAdd={documentDraft.add}
      onRemove={documentDraft.remove}
    />
  ) : null;

  const documentsStepContent = <div className="min-w-0 p-3 sm:p-4">{documentsBody}</div>;

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
      onEditPayment={
        paymentStepId != null ? () => goToStep(paymentStepId) : undefined
      }
      canApplyInvoiceDiscount={allowDiscountEditing && !documentStage && !preparingSave}
      onDiscountChange={allowDiscountEditing && !documentStage && !preparingSave ? handleDiscountChange : undefined}
    >
      {documentStage && savedInvoiceId ? (
        <div className="min-w-0 rounded-lg border p-3 sm:p-4">
          <p role="status" className="mb-3 text-sm text-muted-foreground">
            {t("invoices.documents.savedHint")}
          </p>
          <InvoiceDocumentsSection
            key={savedInvoiceId}
            compact
            invoice={{ ...values, invoiceId: savedInvoiceId }}
            initialFiles={pendingUploadFiles ?? []}
            onBusyChange={setDocumentsBusy}
            onUploadsComplete={finishSave}
          />
        </div>
      ) : documentsBody ? (
        <div className="min-w-0 print:hidden">{documentsBody}</div>
      ) : null}
      {policiesReviewSection}
    </InvoiceFormPreviewStep>
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
      <Button data-wizard-primary type="button" className="max-sm:px-3" onClick={handleNext}>
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
        <Button data-wizard-primary type="button" className="max-sm:px-3" onClick={handleSave} disabled={saveDisabled}>
          {isSubmitting || preparingSave || documentsBusy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {isSubmitting || preparingSave || documentsBusy ? t("common.actions.saving") : submitLabel}
        </Button>
      </>
    );

  if (isMobileLayout) {
    const steps = layout.steps.map((entry) => entry.id);
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
        <Button data-wizard-primary type="button" className="h-12 rounded-xl px-4 text-base" onClick={handleNext}>
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
          <Button data-wizard-primary type="button" className="h-12 rounded-xl px-4 text-base" onClick={handleSave} disabled={saveDisabled}>
            {isSubmitting || preparingSave || documentsBusy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            {isSubmitting || preparingSave || documentsBusy ? t("common.actions.saving") : submitLabel}
          </Button>
        </div>
      ) : (
        <Button data-wizard-primary type="button" className="h-12 rounded-xl px-4 text-base" onClick={handleSave} disabled={saveDisabled}>
          {isSubmitting || preparingSave || documentsBusy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {isSubmitting || preparingSave || documentsBusy ? t("common.actions.saving") : submitLabel}
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
        ref={wizardRef}
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
          {step <= 3 ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{formStep}</div>
          ) : paymentStepId != null && step === paymentStepId ? (
            <div className="h-full min-w-0 overflow-x-hidden overflow-y-auto px-4 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
              {paymentStepContent}
            </div>
          ) : step === documentsStepId ? (
            <div className="h-full min-w-0 overflow-x-hidden overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
              {documentsStepContent}
            </div>
          ) : (
            <div className="h-full min-w-0 overflow-x-hidden overflow-y-auto px-4 py-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
              {previewContent}
            </div>
          )}
        </div>

        {step >= 3 ? (
          <InvoiceWizardSummaryMobileBar
            values={values}
            onDiscountChange={summaryDiscountChange}
            showPayment={requireDailyIncomeRegistration}
            registeredCost={registeredCost}
            className="shrink-0 border-t border-border/70 bg-card px-3 py-2"
          />
        ) : null}

        <div
          data-print-hide
          className="grid shrink-0 grid-cols-2 gap-3 border-t border-border bg-background px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
        >
          {footerNotice ? <div className="col-span-2">{footerNotice}</div> : null}
          {phoneBackControl}
          {phonePrimary}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={wizardRef}
      data-testid="invoice-form-wizard"
      className={cn("flex min-h-0 flex-1 flex-col", invoiceWizardTypographyRoot)}
    >
      <div data-print-hide>
        <InvoiceWizardStepper
          step={step}
          layout={layout}
          onSelectStep={handleSelectStep}
          canSelectStep={() => !(preparingSave || isSubmitting || documentsBusy || documentStage)}
        />
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-card">
          <div
            data-print-hide
            className="shrink-0 space-y-1 border-b border-border bg-card px-5 py-3"
          >
            <p className={cn(invoiceStepEyebrowClassName, "hidden sm:block")}>
              {t("invoices.wizard.stepEyebrow", {
                step,
                total: previewStep,
                label: t(stepLabelKey),
              })}
            </p>
            <h2 className={invoiceStepTitleClassName}>{t(stepTitleKey)}</h2>
            {stepHintKey ? <p className="text-sm text-muted-foreground">{t(stepHintKey)}</p> : null}
          </div>

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
            {paymentStepId != null && step === paymentStepId ? (
              <div className="min-h-0 flex-1 overflow-y-auto bg-muted/35 pb-6">
                {paymentStepContent}
              </div>
            ) : step === documentsStepId ? (
              <div className="min-h-0 flex-1 overflow-y-auto bg-muted/35 pb-6">
                {documentsStepContent}
              </div>
            ) : step === previewStep ? (
              <div className="min-h-0 flex-1 overflow-y-auto bg-muted/35 pb-6">
                {previewContent}
              </div>
            ) : null}
          </div>

          <InvoiceWizardSummaryMobileBar
            values={values}
            onDiscountChange={summaryDiscountChange}
            showPayment={requireDailyIncomeRegistration}
            registeredCost={registeredCost}
          />
        </div>

        <InvoiceWizardSummarySidebar
          values={values}
          onDiscountChange={summaryDiscountChange}
          showPayment={requireDailyIncomeRegistration}
          registeredCost={registeredCost}
        />
      </div>

      <div
        data-print-hide
        className="shrink-0 border-t border-border bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5 sm:pb-3"
      >
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {backButton}
            {footerNotice ?? (backButton ? null : <span className="flex-1" aria-hidden />)}
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
