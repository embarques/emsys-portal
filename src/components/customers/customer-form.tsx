"use client";

import {
  AlertCircle,
  IdCard,
  MapPin,
  Phone as PhoneIcon,
  Plus,
  StickyNote,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";

import { PhoneListEditor } from "@/components/phones/phone-list-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { CUSTOMER_ADDRESS_FIELD_LABELS } from "@/lib/customers/form-labels";
import {
  CUSTOMER_TYPE_OPTIONS,
  applyCustomerTypeBranch,
  createEmptyCustomerCoreAddress,
  createEmptyCustomerForm,
  normalizeCustomerFormValues,
  normalizeCustomerType,
  syncCustomerFormAddresses,
  validateCustomerFormValues,
  type CustomerCoreAddress,
  type CustomerFormValues,
} from "@/lib/customers/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const textareaClassName =
  "flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type CustomerFormProps = {
  initialValues?: CustomerFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: CustomerFormValues) => void | Promise<void>;
  onCancel: () => void;
};

type FormSectionProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
};

function FormSection({ icon: Icon, title, description, children }: FormSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold leading-none text-foreground">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
      </div>
      <div className="space-y-4 pl-[2.375rem]">{children}</div>
    </section>
  );
}

type AddressFieldGridProps = {
  idPrefix: string;
  address: CustomerCoreAddress;
  onChange: (field: keyof CustomerCoreAddress, value: string) => void;
};

function AddressFieldGrid({ idPrefix, address, onChange }: AddressFieldGridProps) {
  const labels = CUSTOMER_ADDRESS_FIELD_LABELS;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-address1`}>{labels.address1}</Label>
        <Input
          id={`${idPrefix}-address1`}
          value={address.address1}
          onChange={(event) => onChange("address1", event.target.value)}
          placeholder="Street address"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-address2`}>{labels.address2}</Label>
          <Input
            id={`${idPrefix}-address2`}
            value={address.address2}
            onChange={(event) => onChange("address2", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-apartment`}>{labels.apartment}</Label>
          <Input
            id={`${idPrefix}-apartment`}
            value={address.apartment}
            onChange={(event) => onChange("apartment", event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-city`}>{labels.city}</Label>
          <Input
            id={`${idPrefix}-city`}
            value={address.city}
            onChange={(event) => onChange("city", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-state`}>{labels.state}</Label>
          <Input
            id={`${idPrefix}-state`}
            value={address.state}
            onChange={(event) => onChange("state", event.target.value.toUpperCase())}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-zipcode`}>{labels.zipcode}</Label>
          <Input
            id={`${idPrefix}-zipcode`}
            value={address.zipcode}
            onChange={(event) => onChange("zipcode", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-country`}>{labels.country}</Label>
          <Input
            id={`${idPrefix}-country`}
            value={address.country}
            readOnly
            disabled
            aria-readonly
            className="bg-muted/60"
            title="Country is set automatically by the customer type"
          />
          <p className="text-xs text-muted-foreground">Set automatically by customer type.</p>
        </div>
      </div>
    </div>
  );
}

export function CustomerForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  onSubmit,
  onCancel,
}: CustomerFormProps) {
  const [values, setValues] = useState<CustomerFormValues>(() =>
    normalizeCustomerFormValues(initialValues ?? createEmptyCustomerForm()),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const errorMessage = formError ?? externalError;

  useEffect(() => {
    setValues(normalizeCustomerFormValues(initialValues ?? createEmptyCustomerForm()));
    setFormError(null);
  }, [initialValues?.id, initialValues?.updatedAt]);

  function updateField<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      return key === "customerType" ? applyCustomerTypeBranch(next) : next;
    });
    setFormError(null);
  }

  function updateAddressField<K extends keyof CustomerCoreAddress>(key: K, value: CustomerCoreAddress[K]) {
    setValues((current) =>
      syncCustomerFormAddresses({
        ...current,
        address: { ...current.address, [key]: value },
      }),
    );
  }

  function updateAdditionalAddressField<K extends keyof CustomerCoreAddress>(
    index: number,
    key: K,
    value: CustomerCoreAddress[K],
  ) {
    setValues((current) => {
      const addresses = current.addresses.map((entry, addressIndex) =>
        addressIndex === index ? { ...entry, [key]: value } : entry,
      );

      return syncCustomerFormAddresses({ ...current, addresses });
    });
  }

  function addAddress() {
    setValues((current) =>
      syncCustomerFormAddresses({
        ...current,
        addresses: [...current.addresses, createEmptyCustomerCoreAddress(current.address.country)],
      }),
    );
  }

  function removeAddress(index: number) {
    if (index <= 0) return;

    setValues((current) =>
      syncCustomerFormAddresses({
        ...current,
        addresses: current.addresses.filter((_, addressIndex) => addressIndex !== index),
      }),
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const nextValues = normalizeCustomerFormValues(syncCustomerFormAddresses(values));

    try {
      validateCustomerFormValues(nextValues);
      setFormError(null);
      onSubmit(nextValues);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save customer.");
    }
  }

  const selectedType = normalizeCustomerType(values.customerType);
  const branchHint =
    CUSTOMER_TYPE_OPTIONS.find((option) => option.value === selectedType)?.label === "Receiver"
      ? "Receivers are assigned to the DR branch."
      : "Senders are assigned to the USA branch.";

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
        <FormSection icon={User} title="General" description="Basic identity and routing for this customer.">
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={values.name}
              onChange={(event) => updateField("name", event.target.value)}
              placeholder="Full name"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customerType">
              Customer type <span className="text-destructive">*</span>
            </Label>
            <select
              id="customerType"
              className={selectClassName}
              value={selectedType}
              onChange={(event) => updateField("customerType", Number(event.target.value))}
              required
            >
              {CUSTOMER_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{branchHint}</p>
          </div>
        </FormSection>

        <div className="border-t border-border/60" />

        <FormSection
          icon={PhoneIcon}
          title="Phones"
          description="At least one phone number is required. Mark one as primary."
        >
          <PhoneListEditor
            idPrefix="customer-phone"
            phones={values.phones}
            required
            onChange={(phones) => updateField("phones", phones)}
          />
        </FormSection>

        <div className="border-t border-border/60" />

        <FormSection icon={IdCard} title="Contact & identification" description="Optional contact and reference details.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="IDNumber">ID number</Label>
              <Input
                id="IDNumber"
                value={values.IDNumber}
                onChange={(event) => updateField("IDNumber", event.target.value)}
              />
            </div>
          </div>
        </FormSection>

        <div className="border-t border-border/60" />

        <FormSection icon={MapPin} title="Addresses" description="Primary address is used for shipping and directions.">
          <div className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Primary address
              </p>
              <AddressFieldGrid
                idPrefix="primary"
                address={values.address}
                onChange={(field, value) => updateAddressField(field, value)}
              />
            </div>

            {values.addresses.slice(1).map((address, index) => {
              const addressIndex = index + 1;

              return (
                <div key={addressIndex} className="rounded-lg border border-border/60 bg-muted/20 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Additional address {addressIndex}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => removeAddress(addressIndex)}
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  </div>

                  <AddressFieldGrid
                    idPrefix={`additional-${addressIndex}`}
                    address={address}
                    onChange={(field, value) => updateAdditionalAddressField(addressIndex, field, value)}
                  />
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full border-dashed text-muted-foreground hover:text-foreground"
              onClick={addAddress}
            >
              <Plus className="size-4" />
              Add another address
            </Button>
          </div>
        </FormSection>

        <div className="border-t border-border/60" />

        <FormSection icon={StickyNote} title="Notes" description="Internal notes visible to your team.">
          <textarea
            id="notes"
            value={values.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={3}
            className={textareaClassName}
            placeholder="Add any relevant context…"
          />
        </FormSection>
      </div>

      <div className="shrink-0 border-t border-border bg-card px-6 py-4">
        {errorMessage ? (
          <div
            className={cn(
              "mb-3 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2",
              "text-sm text-destructive",
            )}
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
