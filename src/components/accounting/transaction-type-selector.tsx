"use client";

import { type ReactNode, useId, useState } from "react";
import { Check, ChevronRight } from "lucide-react";

import { buildTransactionEntryGroups, type TransactionEntryCategory } from "@/lib/accounting/daily-income/transaction-type-config";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  value: TransactionEntryCategory | null;
  children?: ReactNode;
  isBusy?: boolean;
  onGroupChange?: () => void;
  onChange: (type: TransactionEntryCategory) => void;
  appearance?: "default" | "phone";
  inventoryPaymentEnabled?: boolean;
  loanIssueEnabled?: boolean;
  loanIncreaseEnabled?: boolean;
  loanPaymentEnabled?: boolean;
};

export function TransactionTypeSelector({ value, onChange, children, onGroupChange, isBusy = false, appearance = "default", inventoryPaymentEnabled = true, loanIssueEnabled = true, loanIncreaseEnabled = true, loanPaymentEnabled = true }: Props) {
  const { t } = useTranslation();
  const groupId = useId();
  const groups = buildTransactionEntryGroups(t);
  const [activeGroupId, setActiveGroupId] = useState(() =>
    groups.find((group) => group.options.some((option) => option.value === value))?.id ?? groups[0].id,
  );
  const [dismissedValue, setDismissedValue] = useState<TransactionEntryCategory | null>(null);
  const highlightedValue = value === dismissedValue ? null : value;
  const isPhone = appearance === "phone";
  const disabled = (category: TransactionEntryCategory) =>
    isBusy || (category === "INVENTORY-PAYMENT" && !inventoryPaymentEnabled) ||
    (category === "LOAN-ISSUE" && !loanIssueEnabled) ||
    (category === "LOAN-INCREASE" && !loanIncreaseEnabled) ||
    (category === "LOAN-PAYMENT" && !loanPaymentEnabled);

  if (children) {
    const activeGroup = groups.find((group) => group.id === activeGroupId) ?? groups[0];
    return (
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden" aria-label={t("accounting.dailyIncome.wizard.typeSelector.ariaLabel")}>
        <div role="region" aria-label={activeGroup.label} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4" aria-label={t("accounting.dailyIncome.wizard.typeSelector.ariaLabel")}>
      <h3 className={cn("text-base font-semibold", isPhone && "sr-only")}>
        {t("accounting.dailyIncome.wizard.typeSelector.title")}
      </h3>
      <div className={cn(
        "flex min-h-0 flex-col gap-1 rounded-xl border border-border p-2",
        !isPhone && "md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-6 md:p-4",
      )}>
        {groups.map((group, index) => {
          const active = group.id === activeGroupId;
          return (
            <div key={group.id} className="contents">
              <h4 style={{ gridRow: index + 1, gridColumn: 1 }}>
                <button
                  type="button"
                  id={`${groupId}-${group.id}-heading`}
                  disabled={isBusy}
                  aria-expanded={active}
                  aria-controls={`${groupId}-${group.id}-options`}
                  onClick={() => {
                    if (!active) {
                      setDismissedValue(value);
                      onGroupChange?.();
                    }
                    setActiveGroupId(group.id);
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 enabled:hover:bg-accent disabled:opacity-50",
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground",
                  )}
                >
                  {group.label}
                  <ChevronRight aria-hidden="true" className={cn("size-4 shrink-0", active && "rotate-90", !isPhone && "md:rotate-0")} />
                </button>
              </h4>
              <div
                id={`${groupId}-${group.id}-options`}
                role="region"
                aria-labelledby={`${groupId}-${group.id}-heading`}
                hidden={!active}
                className={cn("min-h-0 min-w-0 px-2 pb-3", !isPhone && "md:col-start-2 md:row-span-5 md:row-start-1 md:border-l md:border-border md:pb-0 md:pl-6 md:pr-0")}
              >
                <div className="divide-y divide-border/60">
                  {group.options.map((option) => {
                    const Icon = option.icon;
                    const selected = highlightedValue === option.value;
                    return (
                      <div key={option.value} className="py-1 first:pt-0 last:pb-0">
                        <button
                          type="button"
                          aria-labelledby={`${groupId}-${option.value}-label`}
                          aria-describedby={`${groupId}-${option.value}-description`}
                          disabled={disabled(option.value)}
                          onClick={() => {
                            setDismissedValue(null);
                            onChange(option.value);
                          }}
                          className={cn(
                            "flex min-h-16 w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
                            "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring enabled:hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
                            selected && "bg-primary/5",
                          )}
                        >
                          <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", option.iconBackgroundClassName)}>
                            <Icon className={cn("size-4", option.iconClassName)} aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span id={`${groupId}-${option.value}-label`} className="block text-sm font-medium">{t(`accounting.dailyIncome.wizard.typeSelector.options.${option.value}`)}</span>
                            <span id={`${groupId}-${option.value}-description`} className="mt-0.5 block text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          </span>
                          {selected ? <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
