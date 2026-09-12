"use client";

import { Building2, Mail, MapPin, Phone, Plus, Trash2, User } from "lucide-react";
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
  removeLabel,
  values,
  placeholder,
  type = "text",
  onChange,
}: {
  id: string;
  label: string;
  addLabel: string;
  removeLabel: string;
  values: string[];
  placeholder: string;
  type?: "text" | "email";
  onChange: (values: string[]) => void;
}) {
  const entries = values.length > 0 ? values : [""];

  return (
    <div className="space-y-2">
      {entries.map((value, index) => {
        const isOnly = entries.length <= 1;

        return (
          <div key={`${id}-${index}`} className="flex items-center gap-2">
            <Input
              id={`${id}-${index}`}
              type={type}
              value={value}
              placeholder={placeholder}
              aria-label={entries.length > 1 ? `${label} ${index + 1}` : label}
              onChange={(event) =>
                onChange(entries.map((entry, entryIndex) => (entryIndex === index ? event.target.value : entry)))
              }
              onFocus={selectFormFieldTextOnFocus}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title={removeLabel}
              disabled={isOnly}
              className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() =>
                onChange(entries.length > 1 ? entries.filter((_, entryIndex) => entryIndex !== index) : [""])
              }
              aria-label={removeLabel}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        className="h-9 w-full justify-center border-dashed border-primary/40 bg-card text-primary hover:bg-primary/10 hover:text-primary"
        onClick={() => onChange([...entries, ""])}
      >
        <Plus className="size-4" />
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
          <div className="space-y-1">
            <Label htmlFor="companyName">
              {t("inventory.form.fields.companyName")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="companyName"
              value={values.companyName}
              onChange={(event) => setValues((current) => ({ ...current, companyName: event.target.value }))}
              onFocus={selectFormFieldTextOnFocus}
              required
            />
          </div>
        </FormSection>

        <FormSection icon={User} title={t("inventory.form.sections.contacts")}>
          <RepeatableTextList
            id="contactName"
            label={t("inventory.form.fields.contactNames")}
            addLabel={t("inventory.form.addContact")}
            removeLabel={t("inventory.form.removeContact")}
            values={values.contactNames}
            placeholder={t("inventory.form.placeholders.contactName")}
            onChange={(contactNames) => setValues((current) => ({ ...current, contactNames }))}
          />
        </FormSection>

        <FormSection icon={MapPin} title={t("inventory.form.sections.addresses")}>
          <RepeatableTextList
            id="address"
            label={t("inventory.form.fields.addresses")}
            addLabel={t("inventory.form.addAddress")}
            removeLabel={t("inventory.form.removeAddress")}
            values={values.addresses}
            placeholder={t("inventory.form.placeholders.address")}
            onChange={(addresses) => setValues((current) => ({ ...current, addresses }))}
          />
        </FormSection>

        <FormSection icon={Phone} title={t("inventory.form.sections.phones")}>
          <PhoneListEditor
            idPrefix="supplier-phone"
            phones={values.phones}
            compact
            onChange={(phones) => setValues((current) => ({ ...current, phones }))}
          />
        </FormSection>

        <FormSection icon={Mail} title={t("inventory.form.sections.emails")}>
          <RepeatableTextList
            id="email"
            label={t("inventory.form.fields.emails")}
            addLabel={t("inventory.form.addEmail")}
            removeLabel={t("inventory.form.removeEmail")}
            values={values.emails}
            placeholder={t("inventory.form.placeholders.email")}
            type="email"
            onChange={(emails) => setValues((current) => ({ ...current, emails }))}
          />
        </FormSection>
      </FormBody>

      <FormFooter error={validationError} submitLabel={submitLabel} onCancel={onCancel} isSubmitting={isSubmitting} />
    </form>
  );
}
