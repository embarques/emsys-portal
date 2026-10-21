"use client";

import { WorkflowStepper } from "@/components/forms/workflow-stepper";

import { useTranslation } from "@/lib/i18n";

export const INVOICE_WIZARD_STEP_ORDER = [1, 2, 3, 4, 5, 6, 7] as const;

export type InvoiceWizardStep = (typeof INVOICE_WIZARD_STEP_ORDER)[number];
export type InvoiceWizardFormStep = 1 | 2 | 3;

export type InvoiceWizardStepKind =
  | "details"
  | "parties"
  | "lineItems"
  | "payment"
  | "documents"
  | "preview";

export type InvoiceWizardLayoutStep = {
  id: InvoiceWizardStep;
  kind: InvoiceWizardStepKind;
};

export type InvoiceWizardLayout = {
  steps: InvoiceWizardLayoutStep[];
  previewStep: InvoiceWizardStep;
  paymentStep: InvoiceWizardStep | null;
  documentsStep: InvoiceWizardStep | null;
  includePaymentStep: boolean;
};

const STEP_LABEL_KEYS: Record<InvoiceWizardStepKind, string> = {
  details: "invoices.wizard.steps.details",
  parties: "invoices.wizard.steps.parties",
  lineItems: "invoices.wizard.steps.lineItems",
  payment: "invoices.wizard.steps.payment",
  documents: "invoices.documents.title",
  preview: "invoices.wizard.steps.preview",
};

const STEP_TITLE_KEYS: Record<InvoiceWizardStepKind, string> = {
  details: "invoices.wizard.stepTitles.enterDetails",
  parties: "invoices.wizard.stepTitles.selectParties",
  lineItems: "invoices.wizard.stepTitles.addLineItems",
  payment: "invoices.wizard.stepTitles.paymentInfo",
  documents: "invoices.documents.title",
  preview: "invoices.wizard.stepTitles.reviewAndSave",
};

export function resolveInvoiceWizardLayout(options: {
  requireDailyIncomeRegistration: boolean;
  includeDocumentsStep?: boolean;
}): InvoiceWizardLayout {
  const steps: InvoiceWizardLayoutStep[] = [
    { id: 1, kind: "details" },
    { id: 2, kind: "parties" },
    { id: 3, kind: "lineItems" },
  ];

  let paymentStep: InvoiceWizardStep | null = null;

  if (options.requireDailyIncomeRegistration) {
    const id = (steps.length + 1) as InvoiceWizardStep;
    paymentStep = id;
    steps.push({ id, kind: "payment" });
  }

  const documentsStep = options.includeDocumentsStep
    ? (steps.length + 1) as InvoiceWizardStep
    : null;
  if (documentsStep != null) {
    steps.push({ id: documentsStep, kind: "documents" });
  }

  const previewStep = (steps.length + 1) as InvoiceWizardStep;
  steps.push({ id: previewStep, kind: "preview" });

  return {
    steps,
    previewStep,
    paymentStep,
    documentsStep,
    includePaymentStep: paymentStep != null,
  };
}

export function getInvoiceWizardStepKind(
  layout: InvoiceWizardLayout,
  step: InvoiceWizardStep,
): InvoiceWizardStepKind {
  return layout.steps.find((entry) => entry.id === step)?.kind ?? "details";
}

export function getInvoiceWizardStepLabelKey(kind: InvoiceWizardStepKind): string {
  return STEP_LABEL_KEYS[kind];
}

export function getInvoiceWizardStepTitleKey(kind: InvoiceWizardStepKind): string {
  return STEP_TITLE_KEYS[kind];
}

type Props = {
  step: InvoiceWizardStep;
  layout: InvoiceWizardLayout;
  onSelectStep?: (step: InvoiceWizardStep) => void;
  /** When set, upcoming steps are clickable too (not only completed ones). */
  canSelectStep?: (step: InvoiceWizardStep) => boolean;
};

export function InvoiceWizardStepper({ step, layout, onSelectStep, canSelectStep }: Props) {
  const { t } = useTranslation();
  return (
    <WorkflowStepper
      step={step}
      steps={layout.steps.map((entry) => ({ id: entry.id, label: t(STEP_LABEL_KEYS[entry.kind]) }))}
      onSelectStep={onSelectStep ? (id) => {
        const entry = layout.steps.find((item) => item.id === id);
        if (entry) onSelectStep(entry.id);
      } : undefined}
      canSelectStep={canSelectStep ? (id) => {
        const entry = layout.steps.find((item) => item.id === id);
        return entry ? canSelectStep(entry.id) : false;
      } : undefined}
      ariaLabel={t("invoices.wizard.navAriaLabel")}
      progressLabel={`Step ${layout.steps.findIndex((entry) => entry.id === step) + 1} of ${layout.steps.length}`}
      goToStepLabel={(label) => t("invoices.wizard.goToStep", { label })}
    />
  );
}
