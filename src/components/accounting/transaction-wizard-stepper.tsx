"use client";

import { Check, Pin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type BatchPinProps = {
  /** 1-based stepper indices that can be pinned (type picker and review are usually excluded). */
  pinnableSteps: number[];
  pinnedStep: number | null;
  onPinnedStepChange: (step: number | null) => void;
  disabled?: boolean;
};

type Props = {
  step: number;
  labels: string[];
  disabled?: boolean;
  allowedSteps?: number[];
  onSelectStep: (step: number) => void;
  appearance?: "default" | "phone";
  batchPin?: BatchPinProps;
};

function BatchPinButton({
  stepNumber,
  stepLabel,
  pinned,
  disabled,
  onToggle,
}: {
  stepNumber: number;
  stepLabel: string;
  pinned: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const label = t("accounting.dailyIncome.wizard.batchPinStep", { step: stepLabel });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-pressed={pinned}
          aria-label={label}
          data-batch-pin-step={stepNumber}
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          className={cn(
            "size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground",
            pinned && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
          )}
        >
          <Pin className={cn("size-3.5", pinned && "fill-current")} aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function TransactionWizardStepper({
  step,
  labels,
  disabled,
  allowedSteps,
  onSelectStep,
  appearance = "default",
  batchPin,
}: Props) {
  const { t } = useTranslation();
  const pinnedLabel =
    batchPin?.pinnedStep != null ? labels[batchPin.pinnedStep - 1] : null;
  const pinDisabled = disabled || batchPin?.disabled;

  function renderPin(stepNumber: number) {
    if (!batchPin?.pinnableSteps.includes(stepNumber)) return null;
    const pinned = batchPin.pinnedStep === stepNumber;
    return (
      <BatchPinButton
        stepNumber={stepNumber}
        stepLabel={labels[stepNumber - 1] ?? ""}
        pinned={pinned}
        disabled={pinDisabled}
        onToggle={() => batchPin.onPinnedStepChange(pinned ? null : stepNumber)}
      />
    );
  }

  const compactProgress = (
    <div className={cn("space-y-2", appearance !== "phone" && "md:hidden")}>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-medium" aria-live="polite">
          {t("accounting.dailyIncome.wizard.stepCount", { current: step, total: labels.length })} ·{" "}
          {labels[step - 1]}
        </p>
        {renderPin(step)}
      </div>
      <div
        role="progressbar"
        aria-label={labels[step - 1]}
        aria-valuemin={1}
        aria-valuemax={labels.length}
        aria-valuenow={step}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full bg-primary motion-safe:transition-[width]"
          style={{ width: `${(step / labels.length) * 100}%` }}
        />
      </div>
      {pinnedLabel ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t("accounting.dailyIncome.wizard.batchPinnedStatus", { step: pinnedLabel })}
        </p>
      ) : null}
    </div>
  );

  if (appearance === "phone") return compactProgress;

  return (
    <>
      {compactProgress}
      <nav className="hidden md:block" aria-label={t("accounting.dailyIncome.wizard.description")}>
        <ol className="flex items-center gap-2">
          {labels.map((label, index) => {
            const stepNumber = index + 1;
            return (
              <li
                key={`${stepNumber}-${label}`}
                className="flex min-w-0 flex-1 items-center gap-2 after:h-px after:min-w-2 after:flex-1 after:bg-border last:flex-none last:after:hidden"
              >
                <div className="flex min-w-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={
                      disabled ||
                      stepNumber >= step ||
                      (allowedSteps !== undefined && !allowedSteps.includes(stepNumber))
                    }
                    onClick={() => onSelectStep(stepNumber)}
                    aria-current={stepNumber === step ? "step" : undefined}
                    className="group flex min-h-9 min-w-0 items-center gap-2 rounded-md text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default"
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        stepNumber === step
                          ? "border border-primary bg-card text-primary"
                          : stepNumber < step
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {stepNumber < step ? <Check className="size-3.5" /> : stepNumber}
                    </span>
                    <span
                      className={cn(
                        "truncate font-medium leading-tight",
                        stepNumber > step && "text-muted-foreground",
                      )}
                    >
                      {label}
                    </span>
                  </button>
                  {renderPin(stepNumber)}
                </div>
              </li>
            );
          })}
        </ol>
        {pinnedLabel ? (
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {t("accounting.dailyIncome.wizard.batchPinnedStatus", { step: pinnedLabel })}
          </p>
        ) : null}
      </nav>
    </>
  );
}
