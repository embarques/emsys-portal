"use client";

import { useEffect } from "react";

import { SwitchField } from "@/components/ui/switch-field";
import { AUTO_RECONCILE_PERMISSION, isAutoReconcileEligible } from "@/lib/accounting/daily-income/auto-reconcile";
import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";

type Props = {
  id?: string;
  inventoryDirection: DailyIncomeJournalValues["inventoryDirection"];
  inventoryQuantity: DailyIncomeJournalValues["inventoryQuantity"];
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
};

/** Shown only to users who can reconcile dispatches, for dispatched inventory on create. */
export function InventoryAutoReconcileField({
  id = "journal-auto-reconcile",
  inventoryDirection,
  inventoryQuantity,
  checked,
  onCheckedChange,
  className,
}: Props) {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const visible =
    isAutoReconcileEligible({ transactionType: "INVENTORY", inventoryDirection, inventoryQuantity }) &&
    hasPermission(AUTO_RECONCILE_PERMISSION.name, AUTO_RECONCILE_PERMISSION.resourceType);

  useEffect(() => {
    if (!visible && checked) onCheckedChange(false);
  }, [checked, onCheckedChange, visible]);

  if (!visible) return null;

  return (
    <SwitchField
      id={id}
      label={t("accounting.dailyIncome.form.fields.autoReconcile")}
      description={t("accounting.dailyIncome.form.fields.autoReconcileHint")}
      checked={checked}
      onCheckedChange={onCheckedChange}
      className={className}
    />
  );
}
