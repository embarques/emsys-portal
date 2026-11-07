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
import { cn } from "@/lib/utils";
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

const CONTACT_ROW_COLUMNS = "@3xl:grid-cols-[repeat(3,minmax(0,1fr))_2.25rem]";

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
    <div className="flex flex-col gap-2.5">
      <div className={cn("hidden gap-2.5 px-0.5 @3xl:grid", CONTACT_ROW_COLUMNS)} aria-hidden>
        <span className="text-xs font-medium text-muted-foreground">{t("inventory.form.fields.contactName")}</span>
        <span className="text-xs font-medium text-muted-foreground">{t("inventory.form.fields.contactPhone")}</span>
        <span className="text-xs font-medium text-muted-foreground">{t("inventory.form.fields.contactEmail")}</span>
      </div>

      {/* Cap the list against the viewport so the dialog never scrolls on desktop. */}
      <div className="-m-1 space-y-2.5 p-1 @3xl:max-h-[max(6rem,calc(90vh-35rem))] @3xl:overflow-y-auto">
        {entries.map((contact, index) => (
          <div
            key={index}
            role="group"
            aria-label={t("inventory.form.contactNumber", { number: index + 1 })}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5 @3xl:gap-2.5 @3xl:rounded-none @3xl:border-0 @3xl:bg-transparent @3xl:p-0",
              CONTACT_ROW_COLUMNS,
            )}
          >
            <Input
              id={`supplier-contact-name-${index}`}
              aria-label={t("inventory.form.fields.contactName")}
              className="col-start-1 row-start-1"
              value={contact.name}
              placeholder={t("inventory.form.placeholders.contactName")}
              onChange={(event) => patch(index, { name: event.target.value })}
              onFocus={selectFormFieldTextOnFocus}
            />
            <PhoneInput
              id={`supplier-contact-phone-${index}`}
              aria-label={t("inventory.form.fields.contactPhone")}
              className="col-span-2 @3xl:col-span-1 @3xl:col-start-2 @3xl:row-start-1"
              value={contact.phone}
              onChange={(phone) => patch(index, { phone })}
              onFocus={selectFormFieldTextOnFocus}
            />
            <Input
              id={`supplier-contact-email-${index}`}
              type="email"
              aria-label={t("inventory.form.fields.contactEmail")}
              className="col-span-2 @3xl:col-span-1 @3xl:col-start-3 @3xl:row-start-1"
              value={contact.email}
              placeholder={t("inventory.form.placeholders.email")}
              onChange={(event) => patch(index, { email: event.target.value })}
              onFocus={selectFormFieldTextOnFocus}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={entries.length <= 1}
              className="col-start-2 row-start-1 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive @3xl:col-start-4"
              title={t("inventory.form.removeContact")}
              aria-label={t("inventory.form.removeContact")}
              onClick={() => onChange(entries.filter((_, entryIndex) => entryIndex !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-9 w-full shrink-0 justify-center border-dashed border-primary/40 bg-card text-primary hover:bg-primary/10 hover:text-primary"
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
  const optionalBadge = <span className="text-xs text-muted-foreground">{t("inventory.form.workflow.optional")}</span>;

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
      <FormBody workflow isBusy={isSubmitting}>
        <div className="grid gap-5 @3xl:grid-cols-2">
          <FormSection
            variant="card"
            icon={Building2}
            title={`01 · ${t("inventory.form.sections.supplier")}`}
            description={t("inventory.form.workflow.supplierDetailsHint")}
          >
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
            variant="card"
            icon={MapPin}
            title={`02 · ${t("inventory.form.sections.addresses")}`}
            description={t("inventory.form.workflow.addressesDetailsHint")}
            action={optionalBadge}
          >
            <div className="space-y-2">
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
            </div>
          </FormSection>
        </div>

        <FormSection
          variant="card"
          icon={User}
          title={`03 · ${t("inventory.form.sections.contacts")}`}
          description={t("inventory.form.workflow.contactsDetailsHint")}
          action={optionalBadge}
        >
          <SupplierContactsEditor
            contacts={values.contacts}
            onChange={(contacts) => setValues((current) => ({ ...current, contacts }))}
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
