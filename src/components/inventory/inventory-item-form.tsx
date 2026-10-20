"use client";

import { Tag } from "lucide-react";
import { useEffect, useState } from "react";

import { selectFormFieldTextOnFocus, useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { buildInventoryItemPayload } from "@/lib/inventory/schemas/inventory.schema";
import {
  createEmptyInventoryForm,
  EMPTY_ITEM_STOCK_SUMMARY,
  type InventoryFormValues,
  type InventoryItemStockSummary,
} from "@/lib/inventory/types";

type InventoryItemFormProps = {
  initialValues?: InventoryFormValues;
  stock?: InventoryItemStockSummary;
  isSubmitting?: boolean;
  submitLabel: string;
  onSubmit: (values: InventoryFormValues) => void;
  onCancel: () => void;
};

export function InventoryItemForm({
  initialValues,
  stock = EMPTY_ITEM_STOCK_SUMMARY,
  isSubmitting = false,
  submitLabel,
  onSubmit,
  onCancel,
}: InventoryItemFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<InventoryFormValues>(initialValues ?? createEmptyInventoryForm());
  const [validationError, setValidationError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();
  const validation = buildInventoryItemPayload(values);

  useEffect(() => {
    setValues(initialValues ?? createEmptyInventoryForm());
    setValidationError(null);
  }, [initialValues]);

  function updateField<K extends keyof InventoryFormValues>(key: K, value: InventoryFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setValidationError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validation.ok) {
      setValidationError(t(validation.error));
      return;
    }
    setValidationError(null);
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting} className="@container min-h-0 space-y-5 p-4 sm:p-6">
        <FormSection
          icon={Tag}
          title={`01 · ${t("inventory.form.sections.identification")}`}
          className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <p className="text-sm text-muted-foreground">{t("inventory.form.workflow.itemHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="item-name">{t("inventory.form.fields.name")} <span className="text-destructive">*</span></Label>
              <Input
                id="item-name"
                autoFocus
                value={values.name}
                onChange={(event) => updateField("name", event.target.value)}
                onFocus={selectFormFieldTextOnFocus}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-sku">{t("inventory.form.fields.sku")}</Label>
              <Input
                id="item-sku"
                value={values.sku}
                placeholder={t("inventory.form.placeholders.sku")}
                onChange={(event) => updateField("sku", event.target.value)}
                onFocus={selectFormFieldTextOnFocus}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-category">{t("inventory.form.fields.category")}</Label>
              <Input
                id="item-category"
                value={values.category}
                placeholder={t("inventory.form.placeholders.categoryText")}
                onChange={(event) => updateField("category", event.target.value)}
                onFocus={selectFormFieldTextOnFocus}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-unit">{t("inventory.form.fields.unit")}</Label>
              <Input
                id="item-unit"
                value={values.unitOfMeasure}
                placeholder={t("inventory.form.placeholders.unit")}
                onChange={(event) => updateField("unitOfMeasure", event.target.value)}
                onFocus={selectFormFieldTextOnFocus}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-price">{t("inventory.form.fields.defaultSellingPrice")}</Label>
              <Input
                id="item-price"
                inputMode="decimal"
                placeholder="0.00"
                value={values.defaultSellingPrice}
                onChange={(event) => updateField("defaultSellingPrice", event.target.value)}
                onFocus={selectFormFieldTextOnFocus}
              />
              <p className="text-xs text-muted-foreground">{t("inventory.form.workflow.priceHint")}</p>
            </div>
          </div>
        </FormSection>
        <FormSection
          icon={Tag}
          title={`02 · ${t("inventory.form.sections.stockLevels")}`}
          className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="item-available">{t("inventory.columns.available")}</Label>
              <Input className="bg-muted/40 tabular-nums" id="item-available" readOnly value={String(stock.available)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-quarantined">{t("inventory.columns.quarantined")}</Label>
              <Input className="bg-muted/40 tabular-nums" id="item-quarantined" readOnly value={String(stock.quarantined)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reorderThreshold">{t("inventory.form.fields.reorderThreshold")}</Label>
              <Input
                id="reorderThreshold"
                type="number"
                min={0}
                step={1}
                aria-describedby="reorder-threshold-hint"
                value={values.reorderThreshold}
                onChange={(event) => updateField("reorderThreshold", event.target.value)}
                onFocus={selectFormFieldTextOnFocus}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("inventory.form.readOnlyStockHint")}</p>
          <p id="reorder-threshold-hint" className="text-xs text-muted-foreground">{t("inventory.form.workflow.reorderHint")}</p>
        </FormSection>
      </FormBody>

      <FormFooter
        error={validationError}
        warning={validation.ok ? null : t(validation.error)}
        isSubmitting={isSubmitting}
        submitLabel={submitLabel}
        onCancel={onCancel}
      />
    </form>
  );
}
