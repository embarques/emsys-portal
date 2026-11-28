"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Loader2, Save } from "lucide-react";

import { useResponsibilityRequiredRecoveryAction } from "@/components/accounting/open-employees-recovery-action";
import { TransactionWizardStepper } from "@/components/accounting/transaction-wizard-stepper";
import { FormFooterNoticeMessage } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The add-transaction wizard's type step. Guided entries rendered inside the wizard prepend it to their
 * own steps so every transaction reads as one workflow with the same stepper, heading and footer.
 * Hosts that already fixed the type (e.g. loans directory) set `includeInStepper: false`.
 */
export type GuidedTypeStep = {
  label: string;
  onBack: () => void;
  onCancel: () => void;
  appearance?: "default" | "phone";
  /** When false, type is already fixed and is omitted from progress. Default true. */
  includeInStepper?: boolean;
};

export function typeStepCountsInStepper(typeStep?: GuidedTypeStep | null): boolean {
  return Boolean(typeStep && typeStep.includeInStepper !== false);
}

export function GuidedEntryStepper({ typeStep, labels, step, busy, onStepChange, appearance }: {
  typeStep?: GuidedTypeStep;
  labels: string[];
  /** 1-based step within `labels`. */
  step: number;
  busy: boolean;
  onStepChange: (step: number) => void;
  appearance?: "default" | "phone";
}) {
  const includeType = typeStepCountsInStepper(typeStep);
  const offset = includeType ? 1 : 0;
  return (
    <div className="shrink-0 border-b bg-card px-5 py-4">
      <TransactionWizardStepper
        step={step + offset}
        labels={includeType && typeStep ? [typeStep.label, ...labels] : labels}
        disabled={busy}
        appearance={appearance ?? typeStep?.appearance}
        onSelectStep={(next) => next <= offset ? typeStep?.onBack() : onStepChange(next - offset)}
      />
    </div>
  );
}

export function GuidedStepHeading({ title, hint, focusKey }: {
  title: string;
  hint: string;
  /** Focus moves to the heading whenever this changes. */
  focusKey: unknown;
  appearance?: "default" | "phone";
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [focusKey]);
  return (
    <header className="max-w-2xl space-y-2">
      <h2 ref={heading} data-step-heading tabIndex={-1} className="text-2xl font-semibold tracking-tight outline-none">{title}</h2>
      <p className="text-sm leading-relaxed text-muted-foreground">{hint}</p>
    </header>
  );
}

export function GuidedEntryFooter({ busy, onPrevious, onCancel, submitLabel, final = false, submitDisabled = false, formId, error, warning, appearance }: {
  busy: boolean;
  onPrevious?: () => void;
  onCancel: () => void;
  /** Omit to hide the submit button (e.g. on a selection-only step). */
  submitLabel?: string;
  final?: boolean;
  submitDisabled?: boolean;
  formId?: string;
  error?: string | null;
  warning?: string | null;
  appearance?: "default" | "phone";
}) {
  const { t } = useTranslation();
  const responsibilityAction = useResponsibilityRequiredRecoveryAction(error);
  return (
    <div className={cn("shrink-0 space-y-3 border-t border-border bg-card px-5 py-3", appearance === "phone" && "pb-[calc(env(safe-area-inset-bottom)+1rem)]")}>
      {error ? (
        <FormFooterNoticeMessage tone="error" message={error} action={responsibilityAction} />
      ) : warning ? (
        <FormFooterNoticeMessage tone="warning" message={warning} />
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onPrevious ? (
          <Button type="button" variant="outline" className="mr-auto" disabled={busy} onClick={onPrevious}>
            <ArrowLeft className="size-4" />{t("common.actions.previous")}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>{t("common.actions.cancel")}</Button>
        {submitLabel ? (
          <Button type="submit" form={formId} disabled={busy || submitDisabled} className="h-auto min-h-10 basis-full whitespace-normal py-2 sm:basis-auto">
            {busy ? <Loader2 className="size-4 animate-spin" /> : final ? <Save className="size-4" /> : <ArrowRight className="size-4" />}
            {busy ? t("common.actions.saving") : submitLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
