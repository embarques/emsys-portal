"use client";

import { Package } from "lucide-react";
import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import { createEmptyItemForm, type ItemFormValues } from "@/lib/items/types";

const textareaClassName =
  "flex min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type ItemFormProps = {
  initialValues?: ItemFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  externalError?: string | null;
  isSubmitting?: boolean;
  onSubmit: (values: ItemFormValues) => void;
  onCancel: () => void;
};

export function ItemForm({
  initialValues,
  isEditing = false,
  updatedAt,
  submitLabel,
  externalError = null,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: ItemFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<ItemFormValues>(initialValues ?? createEmptyItemForm());
  const [validationError, setValidationError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyItemForm());
    setValidationError(null);
  }, [initialValues]);

  function updateField<K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setValidationError(null);
  }

  function getValidationError(): string | null {
    if (!values.description.trim()) {
      return t("items.form.validation.descriptionRequired");
    }

    const price = Number(values.price);
    if (!Number.isFinite(price) || price < 0) {
      return t("items.form.validation.priceInvalid");
    }

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
      <FormBody isBusy={isSubmitting}>
        <FormSection icon={Package} title={t("items.form.sections.item")}>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="description">
                {t("items.form.fields.description")} <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="description"
                value={values.description}
                onChange={(event) => updateField("description", event.target.value)}
                rows={3}
                className={textareaClassName}
                placeholder={t("items.form.placeholders.description")}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="price">
                {t("items.form.fields.price")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="price"
                type="number"
                min={0}
                step="0.01"
                value={values.price}
                onChange={(event) => updateField("price", event.target.value)}
                placeholder={t("items.form.placeholders.price")}
                required
              />
            </div>
          </div>
        </FormSection>
      </FormBody>

      <FormFooter
        error={externalError ?? validationError}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  );
}
