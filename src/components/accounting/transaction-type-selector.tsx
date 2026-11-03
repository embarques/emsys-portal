"use client";

import { useId } from "react";
import { Check, ChevronRight } from "lucide-react";

import { buildTransactionEntryGroups, type TransactionEntryOption, type TransactionEntryCategory } from "@/lib/accounting/daily-income/transaction-type-config";
import type { JournalTransactionType } from "@/lib/accounting/daily-income/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  value: JournalTransactionType | null;
  onChange: (type: TransactionEntryCategory) => void;
  appearance?: "default" | "phone";
  inventoryPaymentEnabled?: boolean;
  loanIssueEnabled?: boolean;
  loanPaymentEnabled?: boolean;
};

function TypeCard({
  option,
  selected,
  onSelect,
  appearance,
  disabled,
}: {
  option: TransactionEntryOption;
  selected: boolean;
  onSelect: () => void;
  appearance: "default" | "phone";
  disabled?: boolean;
}) {
  const Icon = option.icon;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full min-w-0 items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 enabled:hover:border-primary/50 enabled:hover:bg-accent/30 disabled:cursor-not-allowed disabled:opacity-50",
        appearance === "phone" && "min-h-16",
        selected ? "border-primary ring-1 ring-primary/20" : "border-border",
      )}
    >
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", option.iconBackgroundClassName)}>
        <Icon className={cn("size-4", option.iconClassName)} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm font-semibold">{option.label}</span>
        <span className="block text-xs text-muted-foreground">{option.description}</span>
      </span>
      {selected ? <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> : appearance === "phone" ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
    </button>
  );
}

export function TransactionTypeSelector({ value, onChange, appearance = "default", inventoryPaymentEnabled = true, loanIssueEnabled = true, loanPaymentEnabled = true }: Props) {
  const { t } = useTranslation();
  const groupId = useId();
  const groups = buildTransactionEntryGroups(t);
  const disabled = (category: TransactionEntryCategory) =>
    (category === "INVENTORY-PAYMENT" && !inventoryPaymentEnabled) ||
    (category === "LOAN-ISSUE" && !loanIssueEnabled) ||
    (category === "LOAN-PAYMENT" && !loanPaymentEnabled);

  return (
    <div className="space-y-3">
      <div className={appearance === "phone" ? "sr-only" : undefined}>
        <h3 className="text-base font-semibold">{t("accounting.dailyIncome.wizard.typeSelector.title")}</h3>
      </div>
      <div
        role="radiogroup"
        aria-label={t("accounting.dailyIncome.wizard.typeSelector.ariaLabel")}
        className="space-y-3"
      >
        {groups.map((group) => (
          <div key={group.id} role="group" aria-labelledby={`${groupId}-${group.id}`} className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
            <h4 id={`${groupId}-${group.id}`} className="text-xs font-semibold text-muted-foreground">{group.label}</h4>
            <div className={cn("grid grid-cols-1 gap-2", appearance !== "phone" && "sm:grid-cols-2")}>
              {group.options.map((option) => (
                <TypeCard key={option.value} option={option} selected={value === option.value}
                  onSelect={() => onChange(option.value)} appearance={appearance} disabled={disabled(option.value)} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
