"use client";

import { Check } from "lucide-react";
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

export function WorkflowStepper({
  step,
  steps,
  onSelectStep,
  canSelectStep,
  ariaLabel,
  progressLabel,
  goToStepLabel,
}: {
  step: number;
  steps: { id: number; label: string }[];
  onSelectStep?: (step: number) => void;
  canSelectStep?: (step: number) => boolean;
  ariaLabel: string;
  progressLabel: string;
  goToStepLabel: (label: string) => string;
}) {
  const currentStepIndex = Math.max(
    steps.findIndex((entry) => entry.id === step),
    0,
  );
  const currentStepLabel = steps[currentStepIndex]?.label ?? "";
  const progressValue = ((currentStepIndex + 1) / steps.length) * 100;

  return (
    <nav
      aria-label={ariaLabel}
      className="shrink-0 border-b border-border bg-card px-4 py-3 md:px-5 md:py-2"
    >
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">{currentStepLabel}</p>
          <p className="shrink-0 text-xs font-medium text-muted-foreground">
            {progressLabel}
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
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
