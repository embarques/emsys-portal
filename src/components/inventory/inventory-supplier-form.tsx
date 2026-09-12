"use client";

import { Building2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { selectFormFieldTextOnFocus, useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { PhoneListEditor } from "@/components/phones/phone-list-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/lib/i18n";
import {
  createEmptySupplierForm,
  type SupplierFormValues,
} from "@/lib/inventory/types/suppliers";

type InventorySupplierFormProps = {
  initialValues?: SupplierFormValues;
  submitLabel: string;
  onSubmit: (values: SupplierFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

function RepeatableTextList({
  id,
  label,
  addLabel,
  values,
  placeholder,
  type = "text",
  onChange,
}: {
  id: string;
  label: string;
  addLabel: string;
  values: string[];
  placeholder: string;
  type?: "text" | "email";
  onChange: (values: string[]) => void;
}) {
  const entries = values.length > 0 ? values : [""];

  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-0`}>{label}</Label>
      {entries.map((value, index) => (
        <div key={`${id}-${index}`} className="flex gap-2">
          <Input
            id={`${id}-${index}`}
            type={type}
            value={value}
            placeholder={placeholder}
            onChange={(event) =>
              onChange(entries.map((entry, entryIndex) => (entryIndex === index ? event.target.value : entry)))
            }
            onFocus={selectFormFieldTextOnFocus}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-9 shrink-0"
            onClick={() => onChange(entries.length > 1 ? entries.filter((_, entryIndex) => entryIndex !== index) : [""])}
            aria-label={label}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" className="h-9" onClick={() => onChange([...entries, ""])}>
        <Plus className="h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}

export function InventorySupplierForm({
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InventorySupplierFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<SupplierFormValues>(initialValues ?? createEmptySupplierForm());
  const [validationError, setValidationError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptySupplierForm());
    setValidationError(null);
  }, [initialValues]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.companyName.trim()) {
      setValidationError(t("inventory.form.validation.companyNameRequired"));
      return;
    }
    setValidationError(null);
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
        <FormSection icon={Building2} title={t("inventory.form.sections.supplier")}>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="companyName">{t("inventory.form.fields.companyName")}</Label>
              <Input
                id="companyName"
                value={values.companyName}
                onChange={(event) => setValues((current) => ({ ...current, companyName: event.target.value }))}
                onFocus={selectFormFieldTextOnFocus}
                required
              />
            </div>

            <RepeatableTextList
              id="contactName"
              label={t("inventory.form.fields.contactNames")}
              addLabel={t("inventory.form.addContact")}
              values={values.contactNames}
              placeholder={t("inventory.form.placeholders.contactName")}
              onChange={(contactNames) => setValues((current) => ({ ...current, contactNames }))}
            />

            <RepeatableTextList
              id="address"
              label={t("inventory.form.fields.addresses")}
              addLabel={t("inventory.form.addAddress")}
              values={values.addresses}
              placeholder={t("inventory.form.placeholders.address")}
              onChange={(addresses) => setValues((current) => ({ ...current, addresses }))}
            />

            <div className="space-y-1">
              <Label>{t("inventory.form.fields.phones")}</Label>
              <PhoneListEditor
                idPrefix="supplier-phone"
                phones={values.phones}
                compact
                onChange={(phones) => setValues((current) => ({ ...current, phones }))}
              />
            </div>

            <RepeatableTextList
              id="email"
              label={t("inventory.form.fields.emails")}
              addLabel={t("inventory.form.addEmail")}
              values={values.emails}
              placeholder={t("inventory.form.placeholders.email")}
              type="email"
              onChange={(emails) => setValues((current) => ({ ...current, emails }))}
            />
          </div>
        </FormSection>
      </FormBody>

      <FormFooter error={validationError} submitLabel={submitLabel} onCancel={onCancel} isSubmitting={isSubmitting} />
    </form>
  );
}
