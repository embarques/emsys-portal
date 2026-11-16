"use client";

import { GuidedEntryFooter, GuidedEntryStepper, GuidedStepHeading, type GuidedTypeStep } from "@/components/accounting/guided-entry-chrome";
import { useTranslation } from "@/lib/i18n";

type Props = { step: number; onStepChange: (step: number) => void; busy: boolean; typeStep?: GuidedTypeStep };

const STEP_KEYS = ["assignment", "details", "review"] as const;
const HINT_KEYS = ["loanAssignment", "loanDetails", "loanReview"] as const;

function useLoanStepLabels() {
  const { t } = useTranslation();
  return STEP_KEYS.map((key) => t(`accounting.dailyIncome.wizard.quickFlow.${key}`));
}

export function LoanEntryStepNavigation({ step, onStepChange, busy, typeStep }: Props) {
  return <GuidedEntryStepper typeStep={typeStep} labels={useLoanStepLabels()} step={step} busy={busy} onStepChange={onStepChange} />;
}

export function LoanEntryStepHeading({ step, appearance }: { step: number; appearance?: GuidedTypeStep["appearance"] }) {
  const { t } = useTranslation();
  const labels = useLoanStepLabels();
  return <GuidedStepHeading title={labels[step - 1]} hint={t(`accounting.dailyIncome.wizard.stepHints.${HINT_KEYS[step - 1]}`)} focusKey={step} appearance={appearance} />;
}

export function LoanEntryStepFooter({ step, onStepChange, busy, onCancel, submitLabel, error, warning, submitDisabled, typeStep }: Props & {
  onCancel: () => void; submitLabel: string; error?: string; warning?: string | null; submitDisabled?: boolean;
}) {
  const { t } = useTranslation();
  const labels = useLoanStepLabels();
  const final = step === STEP_KEYS.length;
  return (
    <GuidedEntryFooter
      busy={busy}
      onPrevious={step > 1 ? () => onStepChange(step - 1) : typeStep?.onBack}
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
