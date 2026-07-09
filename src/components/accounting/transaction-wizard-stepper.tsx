"use client";

import { Check } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  step: 1 | 2;
};

export function TransactionWizardStepper({ step }: Props) {
  const { t } = useTranslation();
  const stepOneComplete = step === 2;

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
