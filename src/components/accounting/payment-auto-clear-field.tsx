"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";

import { SwitchField } from "@/components/ui/switch-field";
import { getAutoClearPermission, isAutoClearEligible } from "@/lib/accounting/daily-income/auto-clear";
import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";

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
  const permission = getAutoClearPermission();
  const visible =
    isAutoClearEligible({ transactionType, amount, paymentMethodName }) &&
    Boolean(permission && hasPermission(permission.name, permission.resourceType));

  useEffect(() => {
    if (!visible && checked) onCheckedChange(false);
  }, [checked, onCheckedChange, visible]);

  if (!visible) return null;

  return (
    <SwitchField
      id={id}
      label={t("accounting.dailyIncome.form.fields.autoClear")}
      description={t("accounting.dailyIncome.form.fields.autoClearHint")}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={cn("sm:col-span-2", className)}
    />
  );
}
