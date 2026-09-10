"use client";

import { Tag } from "lucide-react";
import { useEffect, useState } from "react";

import { selectFormFieldTextOnFocus, useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
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
  submitLabel: string;
  onSubmit: (values: InventoryFormValues) => void;
  onCancel: () => void;
};

export function InventoryItemForm({
  initialValues,
  quantityLeft = 0,
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
      <FormBody>
        <FormSection icon={Tag} title={t("inventory.form.sections.identification")}>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="item">{t("inventory.form.fields.item")}</Label>
              <Input
                id="item"
                value={values.item}
                onChange={(event) => updateField("item", event.target.value)}
                onFocus={selectFormFieldTextOnFocus}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quantityLeft">{t("inventory.form.fields.quantityLeft")}</Label>
              <Input id="quantityLeft" readOnly value={String(quantityLeft)} />
              <p className="text-xs text-muted-foreground">{t("inventory.form.readOnlyStockHint")}</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="reorderThreshold">{t("inventory.form.fields.reorderThreshold")}</Label>
              <Input
                id="reorderThreshold"
                type="number"
                min={0}
                value={values.reorderThreshold}
                onChange={(event) => updateField("reorderThreshold", event.target.value)}
                onFocus={selectFormFieldTextOnFocus}
              />
            </div>
          </div>
        </FormSection>
      </FormBody>

      <FormFooter error={validationError} submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}
