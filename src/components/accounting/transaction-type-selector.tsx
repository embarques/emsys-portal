"use client";

import { useId, useState } from "react";
import { Check, ChevronRight, Info } from "lucide-react";

import { buildTransactionEntryGroups, type TransactionEntryCategory } from "@/lib/accounting/daily-income/transaction-type-config";
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

export function TransactionTypeSelector({ value, onChange, appearance = "default", inventoryPaymentEnabled = true, loanIssueEnabled = true, loanPaymentEnabled = true }: Props) {
  const { t } = useTranslation();
  const groupId = useId();
  const groups = buildTransactionEntryGroups(t);
  const [activeGroupId, setActiveGroupId] = useState(() =>
    groups.find((group) => group.options.some((option) => option.value === value))?.id ?? groups[0].id,
  );
  const [previewType, setPreviewType] = useState<TransactionEntryCategory | null>(value);
  const isPhone = appearance === "phone";
  const disabled = (category: TransactionEntryCategory) =>
    (category === "INVENTORY-PAYMENT" && !inventoryPaymentEnabled) ||
    (category === "LOAN-ISSUE" && !loanIssueEnabled) ||
    (category === "LOAN-PAYMENT" && !loanPaymentEnabled);

  return (
    <section className="space-y-4" aria-label={t("accounting.dailyIncome.wizard.typeSelector.ariaLabel")}>
      <h3 className={cn("text-base font-semibold", isPhone && "sr-only")}>
        {t("accounting.dailyIncome.wizard.typeSelector.title")}
      </h3>
      <div className={cn(
        "flex flex-col gap-1 rounded-xl border border-border p-2",
        !isPhone && "md:grid md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-6 md:p-4",
      )}>
        {groups.map((group, index) => {
          const active = group.id === activeGroupId;
          const preview = group.options.find((option) => option.value === previewType) ?? group.options[0];
          return (
            <div key={group.id} className="contents">
              <h4 style={{ gridRow: index + 1, gridColumn: 1 }}>
                <button
                  type="button"
                  id={`${groupId}-${group.id}-heading`}
                  aria-expanded={active}
                  aria-controls={`${groupId}-${group.id}-options`}
                  onClick={() => setActiveGroupId(group.id)}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:bg-accent",
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
                className={cn("min-w-0 px-2 pb-3", !isPhone && "md:col-start-2 md:row-span-5 md:row-start-1 md:border-l md:border-border md:pb-0 md:pl-6 md:pr-0")}
              >
                <div className="divide-y divide-border">
                  {group.options.map((option) => {
                    const Icon = option.icon;
                    const selected = value === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-labelledby={`${groupId}-${option.value}-label`}
                        aria-describedby={`${groupId}-${option.value}-description`}
                        disabled={disabled(option.value)}
                        onClick={() => onChange(option.value)}
                        onFocus={() => setPreviewType(option.value)}
                        onMouseEnter={() => setPreviewType(option.value)}
                        className={cn(
                          "flex min-h-16 w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors",
                          "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring enabled:hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
                          selected && "bg-primary/5",
                        )}
                      >
                        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", option.iconBackgroundClassName)}>
                          <Icon className={cn("size-4", option.iconClassName)} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span id={`${groupId}-${option.value}-label`} className="block text-sm font-medium">{t(`accounting.dailyIncome.wizard.typeSelector.options.${option.value}`)}</span>
                          <span id={`${groupId}-${option.value}-description`} className={cn("mt-0.5 block text-xs text-muted-foreground", !isPhone && "md:sr-only")}>
                            {option.description}
                          </span>
                        </span>
                        {selected ? <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> : <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
                {!isPhone && (
                  <div className="mt-4 hidden min-h-14 items-start gap-2 rounded-lg bg-muted/40 px-3 py-3 text-xs text-muted-foreground md:flex" aria-hidden="true">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    <p>{preview.description}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
