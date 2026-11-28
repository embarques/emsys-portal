"use client";

import { useEffect, useId, useState } from "react";

import { BranchForm } from "@/components/branches/branch-form";
import {
  GuidedEntryFooter,
  GuidedEntryStepper,
} from "@/components/accounting/guided-entry-chrome";
import {
  getBranchFormSteps,
  getBranchStepLabelKey,
  type BranchFormStep,
} from "@/lib/branches/branch-workflow";
import type { BranchFormValues } from "@/lib/branches/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type BranchFormWizardProps = {
  initialValues?: BranchFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  presentation?: "dialog" | "tab";
  appearance?: "default" | "phone";
  onSubmit: (values: BranchFormValues) => void | Promise<void>;
  onCancel: () => void;
};

export function BranchFormWizard({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  presentation = "tab",
  appearance = "default",
  onSubmit,
  onCancel,
}: BranchFormWizardProps) {
  const { t } = useTranslation();
  const formId = useId();
  const steps = getBranchFormSteps();
  const [activeStep, setActiveStep] = useState<BranchFormStep>("branch");
  const [stepError, setStepError] = useState<string | null>(null);
  const stepIndex = steps.indexOf(activeStep);
  const isReview = activeStep === "review";
  const nextStep = steps[Math.min(stepIndex + 1, steps.length - 1)];
  const stepperLabels = steps.map((step) => t(getBranchStepLabelKey(step)));
  const continueLabel = isReview
    ? submitLabel
    : nextStep === "review"
      ? t("branches.wizard.continueToReview")
      : t("branches.wizard.continueToStep", { step: t(getBranchStepLabelKey(nextStep)) });
  const resolvedAppearance = appearance === "phone" || presentation === "dialog" ? "phone" : "default";

  useEffect(() => {
    setActiveStep("branch");
    setStepError(null);
  }, [initialValues, isEditing]);

  return (
    <div
      data-testid="branch-form-wizard"
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden",
        resolvedAppearance === "phone" && "bg-background",
      )}
    >
      <GuidedEntryStepper
        labels={stepperLabels}
        step={stepIndex + 1}
        busy={isSubmitting}
        appearance={resolvedAppearance}
        onStepChange={(step) => setActiveStep(steps[step - 1])}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <fieldset disabled={isSubmitting} className="contents">
          <BranchForm
            formId={formId}
            initialValues={initialValues}
            isEditing={isEditing}
            submitLabel={submitLabel}
            isSubmitting={isSubmitting}
            externalError={externalError}
            activeStep={activeStep}
            onContinue={() => setActiveStep(steps[Math.min(stepIndex + 1, steps.length - 1)])}
            onStepChange={setActiveStep}
            onStepBack={
              stepIndex > 0 ? () => setActiveStep(steps[stepIndex - 1]) : undefined
            }
            stepBackDisabled={isSubmitting}
            onStepErrorChange={setStepError}
            hideFooter
            onSubmit={onSubmit}
            onCancel={onCancel}
          />
        </fieldset>
      </div>
      <GuidedEntryFooter
        busy={isSubmitting}
        onCancel={onCancel}
        submitLabel={continueLabel}
        final={isReview}
        formId={formId}
        error={stepError || externalError}
        appearance={resolvedAppearance}
      />
    </div>
  );
}
