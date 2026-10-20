"use client";

import { Building2, MapPin, Plus, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";

import { AddressAutocompleteInput } from "@/components/addresses/address-autocomplete-input";
import { selectFormFieldTextOnFocus, useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/ui/phone-input";
import { useTranslation } from "@/lib/i18n";
import { buildInventorySupplierPayload } from "@/lib/inventory/schemas/inventory.schema";
import {
  createEmptySupplierContact,
  createEmptySupplierForm,
  type InventorySupplierContact,
  type SupplierFormValues,
} from "@/lib/inventory/types/suppliers";
import type { ParsedPlaceAddress } from "@/lib/customers/types";

type InventorySupplierFormProps = {
  initialValues?: SupplierFormValues;
  submitLabel: string;
  onSubmit: (values: SupplierFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

function formatSelectedAddress(place: ParsedPlaceAddress): string {
  return [place.address1, place.city, [place.state, place.zipcode].filter(Boolean).join(" "), place.country]
    .filter(Boolean)
    .join(", ");
}

function SupplierContactsEditor({
  contacts,
  onChange,
}: {
  contacts: InventorySupplierContact[];
  onChange: (contacts: InventorySupplierContact[]) => void;
}) {
  const { t } = useTranslation();
  const entries = contacts.length > 0 ? contacts : [createEmptySupplierContact()];

  function patch(index: number, next: Partial<InventorySupplierContact>) {
    onChange(entries.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...next } : entry)));
  }

  return (
    <div className="space-y-3">
      {entries.map((contact, index) => (
        <fieldset key={index} className="grid gap-3 rounded-lg border border-border p-3 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <legend className="px-1 text-xs font-medium text-muted-foreground">
            {t("inventory.form.contactNumber", { number: index + 1 })}
          </legend>
          <div className="space-y-1">
            <Label htmlFor={`supplier-contact-name-${index}`}>{t("inventory.form.fields.contactName")}</Label>
            <Input
              id={`supplier-contact-name-${index}`}
              value={contact.name}
              placeholder={t("inventory.form.placeholders.contactName")}
              onChange={(event) => patch(index, { name: event.target.value })}
              onFocus={selectFormFieldTextOnFocus}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`supplier-contact-phone-${index}`}>{t("inventory.form.fields.contactPhone")}</Label>
            <PhoneInput
              id={`supplier-contact-phone-${index}`}
              value={contact.phone}
              onChange={(phone) => patch(index, { phone })}
              onFocus={selectFormFieldTextOnFocus}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`supplier-contact-email-${index}`}>{t("inventory.form.fields.contactEmail")}</Label>
            <Input
              id={`supplier-contact-email-${index}`}
              type="email"
              value={contact.email}
              placeholder={t("inventory.form.placeholders.email")}
              onChange={(event) => patch(index, { email: event.target.value })}
              onFocus={selectFormFieldTextOnFocus}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={entries.length <= 1}
              className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              title={t("inventory.form.removeContact")}
              aria-label={t("inventory.form.removeContact")}
              onClick={() => onChange(entries.filter((_, entryIndex) => entryIndex !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        className="h-9 w-full justify-center border-dashed border-primary/40 bg-card text-primary hover:bg-primary/10 hover:text-primary"
        onClick={() => onChange([...entries, createEmptySupplierContact()])}
      >
        <Plus className="size-4" />
        {t("inventory.form.addContact")}
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
  const validation = buildInventorySupplierPayload(values);

  useEffect(() => {
    setValues(initialValues ?? createEmptySupplierForm());
    setValidationError(null);
  }, [initialValues]);

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
          icon={Building2}
          title={`01 · ${t("inventory.form.sections.supplier")}`}
          className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <p className="text-sm text-muted-foreground">{t("inventory.form.workflow.supplierDetailsHint")}</p>
          <div className="space-y-1">
            <Label htmlFor="companyName">
              {t("inventory.form.fields.companyName")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="companyName"
              autoComplete="organization"
              autoFocus
              value={values.companyName}
              onChange={(event) => setValues((current) => ({ ...current, companyName: event.target.value }))}
              onFocus={selectFormFieldTextOnFocus}
              required
            />
          </div>
        </FormSection>

        <FormSection
          icon={User}
          title={`02 · ${t("inventory.form.sections.contacts")}`}
          className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm"
          action={<span className="text-xs text-muted-foreground">{t("inventory.form.workflow.optional")}</span>}
        >
          <p className="text-sm text-muted-foreground">{t("inventory.form.workflow.contactsDetailsHint")}</p>
          <SupplierContactsEditor
            contacts={values.contacts}
            onChange={(contacts) => setValues((current) => ({ ...current, contacts }))}
          />
        </FormSection>

        <FormSection
          icon={MapPin}
          title={`03 · ${t("inventory.form.sections.addresses")}`}
          className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm"
          action={<span className="text-xs text-muted-foreground">{t("inventory.form.workflow.optional")}</span>}
        >
          <p className="text-sm text-muted-foreground">{t("inventory.form.workflow.addressesDetailsHint")}</p>
          <Label htmlFor="supplier-address">{t("inventory.form.fields.address")}</Label>
          <AddressAutocompleteInput
            id="supplier-address"
            value={values.addresses[0] ?? ""}
            placeholder={t("inventory.form.placeholders.address")}
            allowManualEntry
            className="w-full"
            manualEntryTogglePosition="label"
            onValueChange={(address) =>
              setValues((current) => ({ ...current, addresses: [address, ...current.addresses.slice(1)] }))
            }
            onPlaceSelected={(place) =>
              setValues((current) => ({
                ...current,
                addresses: [formatSelectedAddress(place), ...current.addresses.slice(1)],
              }))
            }
          />
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
