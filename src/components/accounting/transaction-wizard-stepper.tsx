"use client";

import { Check } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  step: number;
  labels: string[];
  disabled?: boolean;
  onSelectStep: (step: number) => void;
  appearance?: "default" | "phone";
};

export function TransactionWizardStepper({ step, labels, disabled, onSelectStep, appearance = "default" }: Props) {
  const { t } = useTranslation();
  if (appearance === "phone") {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium" aria-live="polite">
          {t("accounting.dailyIncome.wizard.stepCount", { current: step, total: labels.length })} · {labels[step - 1]}
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-[width]" style={{ width: `${step / labels.length * 100}%` }} />
        </div>
      </div>
    );
  }
  return (
    <nav aria-label={t("accounting.dailyIncome.wizard.description")}>
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${labels.length}, minmax(0, 1fr))` }}>
        {labels.map((label, index) => (
          <li key={label} className="flex justify-center">
            <button
              type="button"
              disabled={disabled || index + 1 >= step}
              onClick={() => onSelectStep(index + 1)}
              aria-current={index + 1 === step ? "step" : undefined}
              className="group flex flex-col items-center gap-2 rounded-lg text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-default"
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold", index + 1 === step ? "border-2 border-primary bg-card text-primary" : index + 1 < step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                {index + 1 < step ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span className={cn("max-w-28 font-medium leading-tight", index + 1 > step && "text-muted-foreground")}>{label}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
