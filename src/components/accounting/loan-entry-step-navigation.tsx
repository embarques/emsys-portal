"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Loader2, Save } from "lucide-react";
import { TransactionWizardStepper } from "@/components/accounting/transaction-wizard-stepper";
import { FormFooterNoticeMessage } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";

type Props = { step: number; onStepChange: (step: number) => void; busy: boolean };

export function LoanEntryStepNavigation({ step, onStepChange, busy }: Props) {
  const { t } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  const labels = ["assignment", "details", "review"].map((key) => t(`accounting.dailyIncome.wizard.quickFlow.${key}`));
  useEffect(() => { heading.current?.focus(); }, [step]);
  return <div className="shrink-0 space-y-3 border-b bg-card px-5 py-4">
    <TransactionWizardStepper step={step} labels={labels} disabled={busy} onSelectStep={onStepChange} />
    <header className="max-w-2xl space-y-2"><h2 ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">{labels[step - 1]}</h2><p className="text-sm leading-relaxed text-muted-foreground">{t(`accounting.dailyIncome.wizard.stepHints.${["loanAssignment", "loanDetails", "loanReview"][step - 1]}`)}</p></header>
  </div>;
}

export function LoanEntryStepFooter({ step, onStepChange, busy, onCancel, submitLabel, error, warning }: Props & {
  onCancel: () => void; submitLabel: string; error?: string; warning?: string | null;
}) {
  const { t } = useTranslation();
  return <div className="shrink-0 space-y-3 border-t bg-card px-5 py-3">
    {error ? <FormFooterNoticeMessage tone="error" message={error} /> : warning ? <FormFooterNoticeMessage tone="warning" message={warning} /> : null}
    <div className="flex items-center justify-between gap-2">
      <div>{step > 1 ? <Button type="button" variant="outline" disabled={busy} onClick={() => onStepChange(step - 1)}><ArrowLeft className="size-4" />{t("common.actions.previous")}</Button> : null}</div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{t("common.actions.cancel")}</Button>
        <Button type="submit" disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : step === 3 ? <Save className="size-4" /> : <ArrowRight className="size-4" />}{busy ? t("common.actions.saving") : step === 3 ? submitLabel : t("common.actions.next")}</Button>
      </div>
    </div>
  </div>;
}
