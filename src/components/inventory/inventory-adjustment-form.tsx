"use client";

import { SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { InventoryHolderSelect } from "@/components/inventory/inventory-holder-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useTranslation } from "@/lib/i18n";
import { getAdjustmentReasonOptions, getStockConditionLabel } from "@/lib/inventory/display";
import { useHolderStock } from "@/lib/inventory/hooks/use-inventory";
import { buildInventoryAdjustmentPayload } from "@/lib/inventory/schemas/inventory.schema";
import type { InventoryItem } from "@/lib/inventory/types/catalog";
import { INVENTORY_STOCK_CONDITIONS, type InventoryStockCondition } from "@/lib/inventory/types/common";
import { INVENTORY_HOLDER_TYPES, type InventoryHolder } from "@/lib/inventory/types/holders";
import {
  createEmptyAdjustmentForm,
  type AdjustmentFormValues,
  type AdjustmentReason,
} from "@/lib/inventory/types/movements";

type InventoryAdjustmentFormProps = {
  items: InventoryItem[];
  holders: InventoryHolder[];
  submitLabel: string;
  onSubmit: (values: AdjustmentFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function InventoryAdjustmentForm({
  items,
  holders,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InventoryAdjustmentFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<AdjustmentFormValues>(createEmptyAdjustmentForm);
  const [validationError, setValidationError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();
  const holderStock = useHolderStock(values.holderId || undefined);
  const validation = buildInventoryAdjustmentPayload(values);

  const itemOptions = useMemo(
    () =>
      items
        .filter((item) => item.isActive)
        .map((item) => ({ value: item.id, label: item.name, keywords: [item.sku, item.category] })),
    [items],
  );

  const currentBalance = values.itemId
    ? (holderStock.data ?? [])
        .filter((balance) => balance.itemId === values.itemId && balance.condition === values.condition)
        .reduce((sum, balance) => sum + balance.quantityOnHand, 0)
    : null;

  function patch(next: Partial<AdjustmentFormValues>) {
    setValues((current) => ({ ...current, ...next }));
    setValidationError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validation.ok) {
      setValidationError(t(validation.error));
      return;
    }
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
        <FormSection icon={SlidersHorizontal} title={t("inventory.form.adjustStockTitle")}>
          <p className="text-sm text-muted-foreground">{t("inventory.form.workflow.adjustmentHint")}</p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <InventoryHolderSelect
                id="adjustment-holder"
                label={t("inventory.form.fields.holder")}
                value={values.holderId}
                holders={holders}
                allowedTypes={INVENTORY_HOLDER_TYPES}
                placeholder={t("inventory.form.placeholders.holder")}
                required
                onChange={(holderId) => patch({ holderId })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="adjustment-item">{t("inventory.form.fields.item")} <span className="text-destructive">*</span></Label>
              <SearchableSelect
                id="adjustment-item"
                value={values.itemId}
                onValueChange={(itemId) => patch({ itemId })}
                placeholder={t("inventory.form.placeholders.item")}
                searchPlaceholder={t("inventory.search.items")}
                emptyMessage={t("inventory.empty.noOptions")}
                options={itemOptions}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adjustment-condition">{t("inventory.form.fields.condition")}</Label>
              <SearchableSelect
                id="adjustment-condition"
                value={values.condition}
                onValueChange={(next) => patch({ condition: next as InventoryStockCondition })}
                options={INVENTORY_STOCK_CONDITIONS.map((condition) => ({
                  value: condition,
                  label: getStockConditionLabel(condition, t),
                }))}
                searchPlaceholder={t("inventory.search.options")}
                emptyMessage={t("inventory.empty.noOptions")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adjustment-current">{t("inventory.form.fields.currentStock")}</Label>
              <Input
                id="adjustment-current"
                readOnly
                className="bg-muted/40 tabular-nums"
                value={currentBalance === null ? "" : String(currentBalance)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adjustmentSign">{t("inventory.form.fields.adjustmentSign")}</Label>
              <SearchableSelect
                id="adjustmentSign"
                value={values.adjustmentSign}
                onValueChange={(next) => patch({ adjustmentSign: next as AdjustmentFormValues["adjustmentSign"] })}
                options={[
                  { value: "increase", label: t("inventory.form.adjustmentSign.increase") },
                  { value: "decrease", label: t("inventory.form.adjustmentSign.decrease") },
                ]}
                searchPlaceholder={t("inventory.search.options")}
                emptyMessage={t("inventory.empty.noOptions")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adjustment-quantity">{t("inventory.form.fields.quantity")} <span className="text-destructive">*</span></Label>
              <Input
                id="adjustment-quantity"
                type="number"
                min={1}
                step={1}
                value={values.quantity}
                onChange={(event) => patch({ quantity: event.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adjustment-reason">{t("inventory.form.fields.reason")}</Label>
              <SearchableSelect
                id="adjustment-reason"
                value={values.reason}
                onValueChange={(next) => patch({ reason: next as AdjustmentReason })}
                options={getAdjustmentReasonOptions(t)}
                searchPlaceholder={t("inventory.search.options")}
                emptyMessage={t("inventory.empty.noOptions")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adjustment-date">{t("inventory.form.fields.movementDate")} <span className="text-destructive">*</span></Label>
              <Input
                id="adjustment-date"
                type="datetime-local"
                value={values.occurredAt}
                onChange={(event) => patch({ occurredAt: event.target.value })}
                required
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="adjustment-notes">{t("inventory.form.fields.notes")}</Label>
              <Input
                id="adjustment-notes"
                value={values.notes}
                onChange={(event) => patch({ notes: event.target.value })}
                placeholder={t("inventory.form.placeholders.notes")}
              />
            </div>
          </div>
        </FormSection>
      </FormBody>

      <FormFooter
        error={validationError}
        warning={validation.ok ? null : t(validation.error)}
        submitLabel={submitLabel}
        onCancel={onCancel}
        isSubmitting={isSubmitting}
      />
    </form>
  );
}
