"use client";

import { Check, ChevronRight } from "lucide-react";

import { buildTransactionTypeOptions, type TransactionTypeOption } from "@/lib/accounting/daily-income/transaction-type-config";
import type { JournalTransactionType } from "@/lib/accounting/daily-income/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  value: JournalTransactionType | null;
  onChange: (type: JournalTransactionType) => void;
  appearance?: "default" | "phone";
};

function TypeCard({
  option,
  selected,
  onSelect,
  appearance,
}: {
  option: TransactionTypeOption;
  selected: boolean;
  onSelect: () => void;
  appearance: "default" | "phone";
}) {
  const Icon = option.icon;

  if (appearance === "phone") {
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        onClick={onSelect}
        className={cn(
          "flex min-h-24 w-full items-center gap-4 rounded-2xl border bg-card px-4 py-4 text-left shadow-sm transition-colors",
          "hover:border-primary/50 hover:bg-accent/30",
          selected ? "border-primary ring-2 ring-primary/15" : "border-border",
        )}
      >
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-2xl",
            option.iconBackgroundClassName,
          )}
        >
          <Icon className={cn("size-5", option.iconClassName)} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-foreground">{option.label}</span>
          <span className="mt-1 block text-sm text-muted-foreground">{option.description}</span>
        </span>
        <span className="shrink-0 text-muted-foreground">
          {selected ? (
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="size-4" />
            </span>
          ) : (
            <ChevronRight className="size-5" />
          )}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex flex-col items-start gap-3 rounded-xl border bg-card p-4 text-left transition-colors",
        "hover:border-primary/50 hover:bg-accent/30",
        selected ? "border-primary ring-1 ring-primary/20" : "border-border",
      )}
    >
      {selected ? (
        <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" />
        </span>
      ) : null}
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-lg",
          option.iconBackgroundClassName,
        )}
      >
        <Icon className={cn("size-5", option.iconClassName)} />
      </span>
      <span className="space-y-1">
        <span className="block text-sm font-semibold">{option.label}</span>
        <span className="block text-xs text-muted-foreground">{option.description}</span>
      </span>
    </button>
  );
}

export function TransactionTypeSelector({ value, onChange, appearance = "default" }: Props) {
  const { t } = useTranslation();
  const options = buildTransactionTypeOptions(t);

  return (
    <div className={cn("space-y-4", appearance === "phone" && "space-y-3")}>
      <div className={appearance === "phone" ? "sr-only" : undefined}>
        <h3 className="text-base font-semibold">{t("accounting.dailyIncome.wizard.typeSelector.title")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("accounting.dailyIncome.wizard.typeSelector.description")}
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label={t("accounting.dailyIncome.wizard.typeSelector.ariaLabel")}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {options.map((option) => (
          <TypeCard
            key={option.value}
            option={option}
            selected={value === option.value}
            onSelect={() => onChange(option.value)}
            appearance={appearance}
          />
        ))}
      </div>
    </div>
  );
}
