"use client";

import { useEffect } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getAutoClearPermission, isAutoClearEligible } from "@/lib/accounting/daily-income/auto-clear";
import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  transactionType: DailyIncomeJournalValues["transactionType"];
  amount: DailyIncomeJournalValues["amount"];
  paymentMethodName: DailyIncomeJournalValues["paymentMethodName"];
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
};

export function PaymentAutoClearField({
  id = "journal-auto-clear",
  transactionType,
  amount,
  paymentMethodName,
  checked,
  onCheckedChange,
  className,
}: Props) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const permission = getAutoClearPermission(paymentMethodName);
  const visible =
    isAutoClearEligible({ transactionType, amount, paymentMethodName }) &&
    Boolean(permission && hasPermission(permission.name, permission.resourceType));

  useEffect(() => {
    if (!visible && checked) onCheckedChange(false);
  }, [checked, onCheckedChange, visible]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "flex min-w-0 items-start justify-between gap-4 rounded-lg border border-border bg-muted/20 px-4 py-3 sm:col-span-2",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id}>{t("accounting.dailyIncome.form.fields.autoClear")}</Label>
        <p className="text-xs text-muted-foreground">{t("accounting.dailyIncome.form.fields.autoClearHint")}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
