"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";

import { SwitchField } from "@/components/ui/switch-field";
import { getAutoClearPermission, getPaymentClearancePermission, isAutoClearEligible, isBankInvoicePayment, isBankTransaction } from "@/lib/accounting/daily-income/auto-clear";
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
  paymentClearanceChecked?: boolean;
  onPaymentClearanceCheckedChange?: (checked: boolean) => void;
  className?: string;
};

export function PaymentAutoClearField({
  id = "journal-auto-clear",
  transactionType,
  amount,
  paymentMethodName,
  checked,
  onCheckedChange,
  paymentClearanceChecked = false,
  onPaymentClearanceCheckedChange,
  className,
}: Props) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const bankInvoicePayment = isBankInvoicePayment({ transactionType, paymentMethodName });
  const bankTransaction = isBankTransaction({ transactionType, paymentMethodName });
  const permission = bankTransaction ? getPaymentClearancePermission() : getAutoClearPermission();
  const activeChecked = bankTransaction ? paymentClearanceChecked : checked;
  const changeChecked = bankTransaction ? onPaymentClearanceCheckedChange : onCheckedChange;
  const visible =
    (bankTransaction ? (amount ?? 0) > 0 : isAutoClearEligible({ transactionType, amount, paymentMethodName })) &&
    Boolean(changeChecked && permission && hasPermission(permission.name, permission.resourceType));

  useEffect(() => {
    if (!visible && activeChecked) changeChecked?.(false);
  }, [activeChecked, changeChecked, visible]);

  if (!visible) return bankTransaction ? (
    <p className={cn("text-xs text-muted-foreground sm:col-span-2", className)}>{t(bankInvoicePayment ? "accounting.dailyIncome.form.fields.bankPaymentClearanceHint" : "accounting.dailyIncome.form.fields.bankTransactionClearanceHint")}</p>
  ) : null;

  return (
    <SwitchField
      id={id}
      label={t(bankTransaction ? (bankInvoicePayment ? "accounting.dailyIncome.form.fields.autoClearPayment" : "accounting.dailyIncome.form.fields.autoClearTransaction") : "accounting.dailyIncome.form.fields.autoClear")}
      description={t(bankTransaction ? (bankInvoicePayment ? "accounting.dailyIncome.form.fields.bankPaymentAutoClearHint" : "accounting.dailyIncome.form.fields.bankTransactionAutoClearHint") : "accounting.dailyIncome.form.fields.autoClearHint")}
      checked={activeChecked}
      onCheckedChange={changeChecked}
      className={cn("sm:col-span-2", className)}
    />
  );
}
