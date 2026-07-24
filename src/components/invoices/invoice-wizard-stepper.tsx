"use client";

import { Check } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const INVOICE_WIZARD_STEP_ORDER = [1, 2, 3, 4, 5] as const;

export type InvoiceWizardStep = (typeof INVOICE_WIZARD_STEP_ORDER)[number];
export type InvoiceWizardFormStep = 1 | 2 | 3;

const STEP_LABEL_KEYS: Record<InvoiceWizardStep, string> = {
  1: "invoices.wizard.steps.details",
  2: "invoices.wizard.steps.parties",
  3: "invoices.wizard.steps.lineItems",
  4: "invoices.wizard.steps.payment",
  5: "invoices.wizard.steps.preview",
};

const STEP_TITLE_KEYS: Record<InvoiceWizardStep, string> = {
  1: "invoices.wizard.stepTitles.enterDetails",
  2: "invoices.wizard.stepTitles.selectParties",
  3: "invoices.wizard.stepTitles.addLineItems",
  4: "invoices.wizard.stepTitles.paymentInfo",
  5: "invoices.wizard.stepTitles.reviewAndSave",
};

export function getInvoiceWizardStepLabelKey(step: InvoiceWizardStep): string {
  return STEP_LABEL_KEYS[step];
}

export function getInvoiceWizardStepTitleKey(step: InvoiceWizardStep): string {
  return STEP_TITLE_KEYS[step];
}

type Props = {
  step: InvoiceWizardStep;
  includePaymentStep?: boolean;
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
        status === "complete" && "bg-primary text-primary-foreground",
        status === "current" && "border-2 border-primary bg-card text-primary",
        status === "upcoming" && "bg-muted text-muted-foreground",
      )}
    >
      {status === "complete" ? <Check className="size-4" /> : stepNumber}
    </span>
  );
}

export function InvoiceWizardStepper({ step, includePaymentStep = true }: Props) {
  const { t } = useTranslation();

  const steps = includePaymentStep
    ? INVOICE_WIZARD_STEP_ORDER.map((id) => ({ id, labelKey: STEP_LABEL_KEYS[id] }))
    : [
        { id: 1 as const, labelKey: STEP_LABEL_KEYS[1] },
        { id: 2 as const, labelKey: STEP_LABEL_KEYS[2] },
        { id: 3 as const, labelKey: STEP_LABEL_KEYS[3] },
        { id: 4 as const, labelKey: "invoices.wizard.steps.preview" },
      ];
  const currentStepIndex = Math.max(
    steps.findIndex((entry) => entry.id === step),
    0,
  );
  const currentStepLabel = t(steps[currentStepIndex]?.labelKey ?? STEP_LABEL_KEYS[step]);
  const progressValue = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <nav
      aria-label={t("invoices.wizard.navAriaLabel")}
      className="shrink-0 border-b border-border bg-card px-4 py-3 sm:px-8 sm:py-5"
    >
      <div className="sm:hidden">
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

      <div className="relative mx-auto hidden max-w-3xl sm:block">
        <div
          className="absolute top-[1.125rem] h-0.5 bg-border"
          style={{ left: `${50 / steps.length}%`, right: `${50 / steps.length}%` }}
          aria-hidden
        />
        <div
          className="absolute top-[1.125rem] h-0.5 bg-primary transition-[width]"
          style={{
            left: `${50 / steps.length}%`,
            width: `${((step - 1) / (steps.length - 1)) * (100 - 100 / steps.length)}%`,
          }}
          aria-hidden
        />

        <ol className={cn("relative grid gap-2", includePaymentStep ? "grid-cols-5" : "grid-cols-4")}>
          {steps.map((entry) => {
            const status = stepStatus(entry.id, step);

            return (
              <li key={entry.id} className="flex flex-col items-center gap-2 text-center">
                <StepCircle stepNumber={entry.id} status={status} />
                <span
                  className={cn(
                    "max-w-[5.5rem] text-sm font-medium leading-tight",
                    status === "upcoming" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {t(entry.labelKey)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
