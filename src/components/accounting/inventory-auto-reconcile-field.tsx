"use client";

import { useEffect } from "react";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AUTO_RECONCILE_PERMISSION, isAutoReconcileEligible } from "@/lib/accounting/daily-income/auto-reconcile";
import type { DailyIncomeJournalValues } from "@/lib/accounting/daily-income/types";
import { useAuth } from "@/lib/auth/hooks/use-auth";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
    <div
      className={cn(
        "flex min-w-0 items-start justify-between gap-4 rounded-lg border border-border bg-muted/20 px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id}>{t("accounting.dailyIncome.form.fields.autoReconcile")}</Label>
        <p className="text-xs text-muted-foreground">{t("accounting.dailyIncome.form.fields.autoReconcileHint")}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
