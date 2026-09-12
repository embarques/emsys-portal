"use client";

import { Check } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  step: 1 | 2;
  appearance?: "default" | "phone";
};

export function TransactionWizardStepper({ step, appearance = "default" }: Props) {
  const { t } = useTranslation();
  const stepOneComplete = step === 2;
  const currentStepLabel = step === 1
    ? t("accounting.dailyIncome.wizard.steps.selectType")
    : t("accounting.dailyIncome.wizard.steps.enterDetails");

  if (appearance === "phone") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-sm font-semibold text-foreground">{currentStepLabel}</p>
          <p className="shrink-0 text-sm text-muted-foreground">Step {step} of 2</p>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-blue-100">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: step === 1 ? "50%" : "100%" }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-1">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
            stepOneComplete
              ? "bg-emerald-600 text-white"
              : step === 1
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
          )}
        >
          {stepOneComplete ? <Check className="size-3.5" /> : "1"}
        </span>
        <span
          className={cn(
            "text-sm font-medium",
            step === 1 || stepOneComplete ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {t("accounting.dailyIncome.wizard.steps.selectType")}
        </span>
      </div>

      <div
        className={cn("h-px flex-1", stepOneComplete ? "bg-emerald-600" : "bg-border")}
        aria-hidden
      />

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-xs font-semibold",
            step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          2
        </span>
        <span
          className={cn(
            "text-sm font-medium",
            step === 2 ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {t("accounting.dailyIncome.wizard.steps.enterDetails")}
        </span>
      </div>
    </div>
  );
}
