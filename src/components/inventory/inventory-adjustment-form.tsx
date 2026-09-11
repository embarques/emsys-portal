"use client";

import { useEffect, useMemo, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { useTranslation } from "@/lib/i18n";
import { getAdjustmentReasonOptions, getInventoryItemLabel } from "@/lib/inventory/display";
import {
  type AdjustmentFormValues,
} from "@/lib/inventory/types/movements";
import type { InventoryItem } from "@/lib/inventory/types/catalog";

type InventoryAdjustmentFormProps = {
  items: InventoryItem[];
  submitLabel: string;
  onSubmit: (values: AdjustmentFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

function createEmptyAdjustmentForm(): AdjustmentFormValues {
  return {
    itemId: "",
    adjustmentSign: "increase",
    quantity: 1,
    reason: "recount",
    notes: "",
    movementDate: new Date().toISOString().slice(0, 16),
    createdBy: DEFAULT_CREATED_BY,
  };
}

export function InventoryAdjustmentForm({
  items,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InventoryAdjustmentFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<AdjustmentFormValues>(createEmptyAdjustmentForm);
  const handleEnterNavigation = useFormEnterNavigation();

  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        value: item.id,
        label: getInventoryItemLabel(item),
        description: `${t("inventory.form.fields.quantityLeft")}: ${item.quantity}`,
        keywords: [item.item],
      })),
    [items, t],
  );

  useEffect(() => {
    setValues(createEmptyAdjustmentForm());
  }, []);

  const currentStock = values.itemId
    ? (items.find((item) => item.id === values.itemId)?.quantity ?? 0)
    : 0;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit({
      ...values,
      movementDate: new Date(values.movementDate).toISOString(),
    });
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
        <FormSection title={t("inventory.form.adjustStockTitle")}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="itemId">{t("inventory.form.fields.item")}</Label>
              <SearchableSelect
                id="itemId"
                value={values.itemId}
                onValueChange={(next) => setValues((current) => ({ ...current, itemId: next }))}
                placeholder={t("inventory.form.fields.item")}
                searchPlaceholder={t("inventory.search.items")}
                options={itemOptions}
              />
            </div>
            {values.itemId ? (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm sm:col-span-2">
                <span className="text-muted-foreground">{t("inventory.form.fields.currentStock")}: </span>
                <span className="font-medium">
                  {currentStock}
                </span>
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="adjustmentSign">{t("inventory.form.fields.adjustmentSign")}</Label>
              <SearchableSelect
                id="adjustmentSign"
                value={values.adjustmentSign}
                onValueChange={(next) =>
                  setValues((current) => ({
                    ...current,
                    adjustmentSign: next as AdjustmentFormValues["adjustmentSign"],
                  }))
                }
                options={[
                  { value: "increase", label: t("inventory.form.adjustmentSign.increase") },
                  { value: "decrease", label: t("inventory.form.adjustmentSign.decrease") },
                ]}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quantity">{t("inventory.form.fields.quantity")}</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                value={values.quantity}
                onChange={(event) => setValues((current) => ({ ...current, quantity: Number(event.target.value) }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reason">{t("inventory.form.fields.reason")}</Label>
              <SearchableSelect
                id="reason"
                value={values.reason}
                onValueChange={(next) =>
                  setValues((current) => ({ ...current, reason: next as AdjustmentFormValues["reason"] }))
                }
                options={getAdjustmentReasonOptions(t)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="movementDate">{t("inventory.form.fields.movementDate")}</Label>
              <Input
                id="movementDate"
                type="datetime-local"
                value={values.movementDate}
                onChange={(event) => setValues((current) => ({ ...current, movementDate: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="notes">{t("inventory.form.fields.notes")}</Label>
              <Input
                id="notes"
                value={values.notes}
                onChange={(event) => setValues((current) => ({ ...current, notes: event.target.value }))}
                placeholder={t("inventory.form.placeholders.notes")}
              />
            </div>
          </div>
        </FormSection>
      </FormBody>

      <FormFooter submitLabel={submitLabel} onCancel={onCancel} isSubmitting={isSubmitting} />
    </form>
  );
}
