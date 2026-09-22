"use client";

import { Tag } from "lucide-react";
import { useEffect, useState } from "react";

import { selectFormFieldTextOnFocus, useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection, FormWorkflowHints } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import {
  createEmptyInventoryForm,
  type InventoryFormValues,
} from "@/lib/inventory/types";

type InventoryItemFormProps = {
  initialValues?: InventoryFormValues;
  quantityLeft?: number;
  isSubmitting?: boolean;
  submitLabel: string;
  onSubmit: (values: InventoryFormValues) => void;
  onCancel: () => void;
};

export function InventoryItemForm({
  initialValues,
  quantityLeft = 0,
  isSubmitting = false,
  submitLabel,
  onSubmit,
  onCancel,
}: InventoryItemFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<InventoryFormValues>(initialValues ?? createEmptyInventoryForm());
  const [validationError, setValidationError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyInventoryForm());
    setValidationError(null);
  }, [initialValues]);

  function updateField<K extends keyof InventoryFormValues>(key: K, value: InventoryFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setValidationError(null);
  }

  function getValidationError(): string | null {
    if (!values.item.trim()) return t("inventory.form.validation.itemRequired");
    return null;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const error = getValidationError();
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting} className="@container min-h-0 space-y-5 p-4 sm:p-6">
        <FormWorkflowHints requiredHint={t("inventory.form.workflow.requiredHint")} keyboardHint={t("inventory.form.workflow.keyboardHint")} />
        <FormSection
          icon={Tag}
          title={`01 · ${t("inventory.form.sections.identification")}`}
          className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <p className="text-sm text-muted-foreground">{t("inventory.form.workflow.itemHint")}</p>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="item">{t("inventory.form.fields.item")} <span className="text-destructive">*</span></Label>
              <Input
                id="item"
                autoFocus
                value={values.item}
                onChange={(event) => updateField("item", event.target.value)}
                onFocus={selectFormFieldTextOnFocus}
                required
              />
            </div>
          </div>
        </FormSection>
        <FormSection
          icon={Tag}
          title={`02 · ${t("inventory.form.sections.stockLevels")}`}
          className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="quantityLeft">{t("inventory.form.fields.quantityLeft")}</Label>
              <Input className="bg-muted/40 tabular-nums" id="quantityLeft" readOnly value={String(quantityLeft)} />
              <p className="text-xs text-muted-foreground">{t("inventory.form.readOnlyStockHint")}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="reorderThreshold">{t("inventory.form.fields.reorderThreshold")}</Label>
              <Input
                id="reorderThreshold"
                type="number"
                min={0}
                aria-describedby="reorder-threshold-hint"
                value={values.reorderThreshold}
                onChange={(event) => updateField("reorderThreshold", event.target.value)}
                onFocus={selectFormFieldTextOnFocus}
              />
              <p id="reorder-threshold-hint" className="text-xs text-muted-foreground">{t("inventory.form.workflow.reorderHint")}</p>
            </div>
          </div>
        </FormSection>
      </FormBody>

      <FormFooter error={validationError} warning={getValidationError()} isSubmitting={isSubmitting} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}
