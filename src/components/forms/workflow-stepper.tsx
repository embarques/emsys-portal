"use client";

import { Check, Pin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

function stepStatus(
  stepNumber: number,
  current: number,
): "complete" | "current" | "upcoming" {
  if (stepNumber < current) return "complete";
  if (stepNumber === current) return "current";
  return "upcoming";
}

function StepCircle({
  stepNumber,
  status,
}: {
  stepNumber: number;
  status: "complete" | "current" | "upcoming";
}) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        status === "complete" &&
          "bg-primary text-primary-foreground transition-colors group-hover:bg-[color-mix(in_oklab,var(--primary),black_16%)]",
        status === "current" && "border border-primary bg-card text-primary",
        status === "upcoming" && "bg-muted text-muted-foreground",
      )}
    >
      {status === "complete" ? <Check className="size-3.5" /> : stepNumber}
    </span>
  );
}

export type WorkflowStepperBatchPin = {
  /** Step ids that can be thumbtacked (Preview / Review usually excluded). */
  pinnableStepIds: number[];
  pinnedStepId: number | null;
  onPinnedStepChange: (stepId: number | null) => void;
  /** Accessible + tooltip label for a pin control. */
  pinLabel: (stepLabel: string) => string;
  /** Status line when a step is pinned. */
  pinnedStatusLabel?: string | null;
  disabled?: boolean;
};

function BatchPinButton({
  stepLabel,
  pinned,
  disabled,
  pinLabel,
  onToggle,
}: {
  stepLabel: string;
  pinned: boolean;
  disabled?: boolean;
  pinLabel: (stepLabel: string) => string;
  onToggle: () => void;
}) {
  const label = pinLabel(stepLabel);

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

export function WorkflowStepper({
  step,
  steps,
  onSelectStep,
  canSelectStep,
  ariaLabel,
  progressLabel,
  goToStepLabel,
  batchPin,
}: {
  step: number;
  steps: { id: number; label: string }[];
  onSelectStep?: (step: number) => void;
  canSelectStep?: (step: number) => boolean;
  ariaLabel: string;
  progressLabel: string;
  goToStepLabel: (label: string) => string;
  batchPin?: WorkflowStepperBatchPin;
}) {
  const currentStepIndex = Math.max(
    steps.findIndex((entry) => entry.id === step),
    0,
  );
  const currentStepLabel = steps[currentStepIndex]?.label ?? "";
  const progressValue = ((currentStepIndex + 1) / steps.length) * 100;
  const currentEntry = steps[currentStepIndex];
  const showCurrentPin =
    Boolean(batchPin && currentEntry && batchPin.pinnableStepIds.includes(currentEntry.id));
  const pinDisabled = batchPin?.disabled;

  function renderPin(entry: { id: number; label: string }) {
    if (!batchPin?.pinnableStepIds.includes(entry.id)) return null;
    const pinned = batchPin.pinnedStepId === entry.id;
    return (
      <BatchPinButton
        stepLabel={entry.label}
        pinned={pinned}
        disabled={pinDisabled}
        pinLabel={batchPin.pinLabel}
        onToggle={() => batchPin.onPinnedStepChange(pinned ? null : entry.id)}
      />
    );
  }

  return (
    <nav
      aria-label={ariaLabel}
      className="shrink-0 border-b border-border bg-card px-4 py-3 md:px-5 md:py-2"
    >
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm font-semibold text-foreground">{currentStepLabel}</p>
          <div className="flex shrink-0 items-center gap-2">
            {showCurrentPin && currentEntry ? renderPin(currentEntry) : null}
            <p className="shrink-0 text-xs font-medium text-muted-foreground">
              {progressLabel}
            </p>
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${progressValue}%` }}
            aria-hidden
          />
        </div>
        {batchPin?.pinnedStatusLabel ? (
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {batchPin.pinnedStatusLabel}
          </p>
        ) : null}
      </div>

      <div className="hidden md:block">
        <ol className="flex items-center gap-2">
          {steps.map((entry) => {
            const status = stepStatus(entry.id, step);
            const label = entry.label;
            const labelClassName = cn(
              "text-xs font-medium leading-tight",
              status === "upcoming" ? "text-muted-foreground" : "text-foreground",
            );
            const content = (
              <>
                <StepCircle stepNumber={steps.indexOf(entry) + 1} status={status} />
                <span className={labelClassName}>{label}</span>
              </>
            );

            return (
              <li
                key={entry.id}
                className="flex min-w-0 flex-1 items-center gap-2 after:h-px after:min-w-2 after:flex-1 after:bg-border last:flex-none last:after:hidden"
                aria-current={status === "current" ? "step" : undefined}
              >
                <div className="flex min-w-0 items-center gap-1">
                  {onSelectStep && (canSelectStep || status === "complete") ? (
                    <button
                      type="button"
                      disabled={status === "current" || (canSelectStep ? !canSelectStep(entry.id) : false)}
                      className="group flex min-h-9 cursor-pointer items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default"
                      onClick={() => onSelectStep(entry.id)}
                      aria-label={goToStepLabel(label)}
                    >
                      {content}
                    </button>
                  ) : (
                    <span className="flex min-h-9 items-center gap-2">{content}</span>
                  )}
                  {renderPin(entry)}
                </div>
              </li>
            );
          })}
        </ol>
        {batchPin?.pinnedStatusLabel ? (
          <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
            {batchPin.pinnedStatusLabel}
          </p>
        ) : null}
      </div>
    </nav>
  );
}
