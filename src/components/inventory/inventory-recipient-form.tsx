"use client";

import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useTranslation } from "@/lib/i18n";
import { getRecipientTypeOptions } from "@/lib/inventory/display";
import {
  createEmptyRecipientForm,
  type RecipientFormValues,
} from "@/lib/inventory/types/recipients";

type InventoryRecipientFormProps = {
  initialValues?: RecipientFormValues;
  submitLabel: string;
  onSubmit: (values: RecipientFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function InventoryRecipientForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InventoryRecipientFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<RecipientFormValues>(initialValues ?? createEmptyRecipientForm());
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyRecipientForm());
  }, [initialValues]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody>
        <FormSection title={t("inventory.form.sections.recipient")}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="name">{t("inventory.form.fields.recipientName")}</Label>
              <Input
                id="name"
                value={values.name}
                onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="type">{t("inventory.form.fields.type")}</Label>
              <SearchableSelect
                id="type"
                value={values.type}
                onValueChange={(next) =>
                  setValues((current) => ({ ...current, type: next as RecipientFormValues["type"] }))
                }
                options={getRecipientTypeOptions(t)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contactInfo">{t("inventory.form.fields.contactInfo")}</Label>
              <Input
                id="contactInfo"
                value={values.contactInfo}
                onChange={(event) => setValues((current) => ({ ...current, contactInfo: event.target.value }))}
                placeholder={t("inventory.form.placeholders.contactInfo")}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="address">{t("inventory.form.fields.address")}</Label>
              <Input
                id="address"
                value={values.address}
                onChange={(event) => setValues((current) => ({ ...current, address: event.target.value }))}
                placeholder={t("inventory.form.placeholders.address")}
              />
            </div>
          </div>
        </FormSection>
      </FormBody>

      <FormFooter submitLabel={submitLabel} onCancel={onCancel} isSubmitting={isSubmitting} />
    </form>
  );
}
