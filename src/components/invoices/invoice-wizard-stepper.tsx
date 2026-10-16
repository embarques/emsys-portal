"use client";

import { Check } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const INVOICE_WIZARD_STEP_ORDER = [1, 2, 3, 4, 5, 6] as const;

export type InvoiceWizardStep = (typeof INVOICE_WIZARD_STEP_ORDER)[number];
export type InvoiceWizardFormStep = 1 | 2 | 3;

export type InvoiceWizardStepKind =
  | "details"
  | "parties"
  | "lineItems"
  | "payment"
  | "policies"
  | "preview";

export type InvoiceWizardLayoutStep = {
  id: InvoiceWizardStep;
  kind: InvoiceWizardStepKind;
};

export type InvoiceWizardLayout = {
  steps: InvoiceWizardLayoutStep[];
  previewStep: InvoiceWizardStep;
  paymentStep: InvoiceWizardStep | null;
  policiesStep: InvoiceWizardStep | null;
  includePaymentStep: boolean;
  includePoliciesStep: boolean;
};

const STEP_LABEL_KEYS: Record<InvoiceWizardStepKind, string> = {
  details: "invoices.wizard.steps.details",
  parties: "invoices.wizard.steps.parties",
  lineItems: "invoices.wizard.steps.lineItems",
  payment: "invoices.wizard.steps.payment",
  policies: "invoices.wizard.steps.policies",
  preview: "invoices.wizard.steps.preview",
};

const STEP_TITLE_KEYS: Record<InvoiceWizardStepKind, string> = {
  details: "invoices.wizard.stepTitles.enterDetails",
  parties: "invoices.wizard.stepTitles.selectParties",
  lineItems: "invoices.wizard.stepTitles.addLineItems",
  payment: "invoices.wizard.stepTitles.paymentInfo",
  policies: "invoices.wizard.stepTitles.reviewPolicies",
  preview: "invoices.wizard.stepTitles.reviewAndSave",
};

export function resolveInvoiceWizardLayout(options: {
  requireDailyIncomeRegistration: boolean;
  requirePolicySignature: boolean;
}): InvoiceWizardLayout {
  const steps: InvoiceWizardLayoutStep[] = [
    { id: 1, kind: "details" },
    { id: 2, kind: "parties" },
    { id: 3, kind: "lineItems" },
  ];

  let paymentStep: InvoiceWizardStep | null = null;
  let policiesStep: InvoiceWizardStep | null = null;

  if (options.requireDailyIncomeRegistration) {
    const id = (steps.length + 1) as InvoiceWizardStep;
    paymentStep = id;
    steps.push({ id, kind: "payment" });
  }

  if (options.requirePolicySignature) {
    const id = (steps.length + 1) as InvoiceWizardStep;
    policiesStep = id;
    steps.push({ id, kind: "policies" });
  }

  const previewStep = (steps.length + 1) as InvoiceWizardStep;
  steps.push({ id: previewStep, kind: "preview" });

  return {
    steps,
    previewStep,
    paymentStep,
    policiesStep,
    includePaymentStep: paymentStep != null,
    includePoliciesStep: policiesStep != null,
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
};

function stepStatus(
  stepNumber: InvoiceWizardStep,
  current: InvoiceWizardStep,
): "complete" | "current" | "upcoming" {
  if (stepNumber < current) return "complete";
  if (stepNumber === current) return "current";
  return "upcoming";
}

function StepCircle({
  stepNumber,
  status,
}: {
  stepNumber: InvoiceWizardStep;
  status: "complete" | "current" | "upcoming";
}) {
  return (
    <span
      className={cn(
        "relative z-10 flex size-9 items-center justify-center rounded-full text-sm font-semibold",
        status === "complete" &&
          "bg-primary text-primary-foreground transition-colors group-hover:bg-[color-mix(in_oklab,var(--primary),black_16%)]",
        status === "current" && "border-2 border-primary bg-card text-primary",
        status === "upcoming" && "bg-muted text-muted-foreground",
      )}
    >
      {status === "complete" ? <Check className="size-4" /> : stepNumber}
    </span>
  );
}

export function InvoiceWizardStepper({
  step,
  layout,
  onSelectStep,
}: Props) {
  const { t } = useTranslation();
  const steps = layout.steps.map((entry) => ({
    id: entry.id,
    labelKey: STEP_LABEL_KEYS[entry.kind],
  }));
  const currentStepIndex = Math.max(
    steps.findIndex((entry) => entry.id === step),
    0,
  );
  const currentStepLabel = t(steps[currentStepIndex]?.labelKey ?? STEP_LABEL_KEYS.details);
  const progressValue = ((currentStepIndex + 1) / steps.length) * 100;
  const gridColsClass =
    steps.length <= 4
      ? "grid-cols-4"
      : steps.length === 5
        ? "grid-cols-5"
        : "grid-cols-6";

  return (
    <nav
      aria-label={t("invoices.wizard.navAriaLabel")}
      className="shrink-0 border-b border-border bg-card px-4 py-3 md:px-5 md:py-3"
    >
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">{currentStepLabel}</p>
          <p className="shrink-0 text-xs font-medium text-muted-foreground">
            Step {currentStepIndex + 1} of {steps.length}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${progressValue}%` }}
            aria-hidden
          />
        </div>
      </div>

      <div className="relative mx-auto hidden max-w-4xl md:block">
        <div
          className="absolute top-[1.125rem] h-0.5 bg-border"
          style={{ left: `${50 / steps.length}%`, right: `${50 / steps.length}%` }}
          aria-hidden
        />
        <div
          className="absolute top-[1.125rem] h-0.5 bg-primary transition-[width]"
          style={{
            left: `${50 / steps.length}%`,
            width: `${((currentStepIndex) / Math.max(steps.length - 1, 1)) * (100 - 100 / steps.length)}%`,
          }}
          aria-hidden
        />

        <ol className={cn("relative grid gap-2", gridColsClass)}>
          {steps.map((entry) => {
            const status = stepStatus(entry.id, step);
            const label = t(entry.labelKey);
            const labelClassName = cn(
              "max-w-[5.5rem] text-sm font-medium leading-tight",
              status === "upcoming" ? "text-muted-foreground" : "text-foreground",
            );
            const content = (
              <>
                <StepCircle stepNumber={entry.id} status={status} />
                <span className={labelClassName}>{label}</span>
              </>
            );

            return (
              <li
                key={entry.id}
                className="flex flex-col items-center gap-2 text-center"
                aria-current={status === "current" ? "step" : undefined}
              >
                {status === "complete" && onSelectStep ? (
                  <button
                    type="button"
                    className="group flex cursor-pointer flex-col items-center gap-2 rounded-lg text-center outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    onClick={() => onSelectStep(entry.id)}
                    aria-label={t("invoices.wizard.goToStep", { label })}
                  >
                    {content}
                  </button>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
