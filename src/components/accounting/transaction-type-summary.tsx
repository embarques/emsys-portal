"use client";

import { getTransactionTypeOption } from "@/lib/accounting/daily-income/transaction-type-config";
import type { JournalTransactionType } from "@/lib/accounting/daily-income/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  type: JournalTransactionType;
  className?: string;
};

export function TransactionTypeSummary({ type, className }: Props) {
  const { t } = useTranslation();
  const typeOption = getTransactionTypeOption(type, t);
  const TypeIcon = typeOption.icon;

  return (
    <div data-testid="transaction-type-summary" className={cn("flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3", className)}>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          typeOption.iconBackgroundClassName,
        )}
      >
        <TypeIcon className={cn("size-4", typeOption.iconClassName)} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{typeOption.label}</p>
        <p className="text-xs text-muted-foreground">{typeOption.description}</p>
      </div>
    </div>
  );
}
