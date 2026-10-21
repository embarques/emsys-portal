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
        "relative z-10 flex size-9 items-center justify-center rounded-full text-sm font-semibold",
        status === "complete" &&
          "bg-primary text-primary-foreground transition-colors group-hover:bg-[color-mix(in_oklab,var(--primary),black_16%)]",
        status === "current" && "border-2 border-primary bg-card text-primary",
        status === "upcoming" && "bg-muted text-muted-foreground",
      )}
    >
      {status === "complete" ? <Check className="size-4" /> : stepNumber}
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
  const gridColsClass =
    steps.length === 3
      ? "grid-cols-3"
      : steps.length <= 4
      ? "grid-cols-4"
      : steps.length === 5
        ? "grid-cols-5"
        : steps.length === 6
          ? "grid-cols-6"
          : "grid-cols-7";

  return (
    <nav
      aria-label={ariaLabel}
      className="shrink-0 border-b border-border bg-card px-4 py-3 md:px-5 md:py-3"
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

      <div className="relative mx-auto hidden max-w-4xl md:block">
        <div
          className="absolute top-[1.125rem] h-0.5 bg-border"
          style={{ left: `${50 / steps.length}%`, right: `${50 / steps.length}%` }}
          aria-hidden
        />
        <div
          className="absolute top-[1.125rem] h-0.5 bg-primary transition-[width]"
          style={{
            left: `${50 / steps.length}%`,
            width: `${((currentStepIndex) / Math.max(steps.length - 1, 1)) * (100 - 100 / steps.length)}%`,
          }}
          aria-hidden
        />

        <ol className={cn("relative grid gap-2", gridColsClass)}>
          {steps.map((entry) => {
            const status = stepStatus(entry.id, step);
            const label = entry.label;
            const labelClassName = cn(
              "max-w-[5.5rem] text-sm font-medium leading-tight",
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
                className="flex flex-col items-center gap-2 text-center"
                aria-current={status === "current" ? "step" : undefined}
              >
                {onSelectStep && (canSelectStep || status === "complete") ? (
                  <button
                    type="button"
                    disabled={status === "current" || (canSelectStep ? !canSelectStep(entry.id) : false)}
                    className="group flex cursor-pointer disabled:cursor-default flex-col items-center gap-2 rounded-lg text-center outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                    onClick={() => onSelectStep(entry.id)}
                    aria-label={goToStepLabel(label)}
                  >
                    {content}
                  </button>
                ) : (
                  content
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
