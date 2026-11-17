"use client";

import {
  GuidedEntryFooter,
  GuidedEntryStepper,
  GuidedStepHeading,
  typeStepCountsInStepper,
  type GuidedTypeStep,
} from "@/components/accounting/guided-entry-chrome";
import { useTranslation } from "@/lib/i18n";

export type LoanEntryFlowKind = "issue" | "payment" | "increase" | "decrease";

type Props = {
  step: number;
  onStepChange: (step: number) => void;
  busy: boolean;
  typeStep?: GuidedTypeStep;
  kind?: LoanEntryFlowKind;
};

const STEP_KEYS = ["assignment", "details", "review"] as const;

const ASSIGNMENT_LABEL_KEY: Record<LoanEntryFlowKind, string> = {
  issue: "issueAssignment",
  payment: "assignment",
  increase: "assignment",
  decrease: "assignment",
};

const HINT_PREFIX: Record<LoanEntryFlowKind, string> = {
  issue: "loanIssue",
  payment: "loanPayment",
  increase: "loanIncrease",
  decrease: "loanDecrease",
};

function useLoanStepLabels(kind: LoanEntryFlowKind = "payment") {
  const { t } = useTranslation();
  return STEP_KEYS.map((key) =>
    t(`accounting.dailyIncome.wizard.quickFlow.${key === "assignment" ? ASSIGNMENT_LABEL_KEY[kind] : key}`),
  );
}

function useLoanStepHints(kind: LoanEntryFlowKind = "payment") {
  const { t } = useTranslation();
  const prefix = HINT_PREFIX[kind];
  return STEP_KEYS.map((key) => {
    const suffix = key === "assignment" ? "Assignment" : key === "details" ? "Details" : "Review";
    return t(`accounting.dailyIncome.wizard.stepHints.${prefix}${suffix}`);
  });
}

export function LoanEntryStepNavigation({ step, onStepChange, busy, typeStep, kind = "payment" }: Props) {
  return <GuidedEntryStepper typeStep={typeStep} labels={useLoanStepLabels(kind)} step={step} busy={busy} onStepChange={onStepChange} />;
}

export function LoanEntryStepHeading({
  step,
  appearance,
  kind = "payment",
}: {
  step: number;
  appearance?: GuidedTypeStep["appearance"];
  kind?: LoanEntryFlowKind;
}) {
  const labels = useLoanStepLabels(kind);
  const hints = useLoanStepHints(kind);
  return <GuidedStepHeading title={labels[step - 1]} hint={hints[step - 1]} focusKey={step} appearance={appearance} />;
}

export function LoanEntryStepFooter({
  step,
  onStepChange,
  busy,
  onCancel,
  submitLabel,
  error,
  warning,
  submitDisabled,
  typeStep,
  kind = "payment",
}: Props & {
  onCancel: () => void;
  submitLabel: string;
  error?: string;
  warning?: string | null;
  submitDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const labels = useLoanStepLabels(kind);
  const final = step === STEP_KEYS.length;
  const previousFromType = typeStepCountsInStepper(typeStep) ? typeStep?.onBack : undefined;
  return (
    <GuidedEntryFooter
      busy={busy}
      onPrevious={step > 1 ? () => onStepChange(step - 1) : previousFromType}
      onCancel={typeStep?.onCancel ?? onCancel}
      submitLabel={final ? submitLabel : t("accounting.dailyIncome.wizard.continueToStep", { step: labels[step] })}
      final={final}
      submitDisabled={submitDisabled}
      error={error}
      warning={warning}
      appearance={typeStep?.appearance}
    />
  );
}
