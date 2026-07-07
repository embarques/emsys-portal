"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export const INVOICE_WIZARD_STEPS = [
  { id: 1 as const, label: "Details" },
  { id: 2 as const, label: "Parties" },
  { id: 3 as const, label: "Line items" },
  { id: 4 as const, label: "Payment" },
  { id: 5 as const, label: "Preview" },
] as const;

export type InvoiceWizardStep = (typeof INVOICE_WIZARD_STEPS)[number]["id"];
export type InvoiceWizardFormStep = 1 | 2 | 3;

export const INVOICE_WIZARD_STEP_TITLES: Record<InvoiceWizardStep, string> = {
  1: "Enter invoice details",
  2: "Select sender & receiver",
  3: "Add line items",
  4: "Payment information",
  5: "Review & save invoice",
};

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
  const steps = includePaymentStep
    ? INVOICE_WIZARD_STEPS
    : [
        INVOICE_WIZARD_STEPS[0],
        INVOICE_WIZARD_STEPS[1],
        INVOICE_WIZARD_STEPS[2],
        { id: 4 as const, label: "Preview" },
      ];

  return (
    <nav aria-label="Invoice steps" className="shrink-0 border-b border-border bg-card px-4 py-5 sm:px-8">
      <div className="relative mx-auto max-w-3xl">
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
                    "max-w-[5.5rem] text-xs font-medium leading-tight sm:text-sm",
                    status === "upcoming" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {entry.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
