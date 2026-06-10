"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
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
  onSubmit: (values: CustomerFormValues) => void | Promise<void>;
  onCancel: () => void;
};

type AddressFieldGridProps = {
  idPrefix: string;
  address: CustomerCoreAddress;
  onChange: (field: keyof CustomerCoreAddress, value: string) => void;
};

function AddressFieldGrid({ idPrefix, address, onChange }: AddressFieldGridProps) {
  const labels = CUSTOMER_ADDRESS_FIELD_LABELS;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-address1`}>{labels.address1}</Label>
          <Input
            id={`${idPrefix}-address1`}
            value={address.address1}
            onChange={(event) => onChange("address1", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-address2`}>{labels.address2}</Label>
          <Input
            id={`${idPrefix}-address2`}
            value={address.address2}
            onChange={(event) => onChange("address2", event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-apartment`}>{labels.apartment}</Label>
          <Input
            id={`${idPrefix}-apartment`}
            value={address.apartment}
            onChange={(event) => onChange("apartment", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-city`}>{labels.city}</Label>
          <Input
            id={`${idPrefix}-city`}
            value={address.city}
            onChange={(event) => onChange("city", event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-state`}>{labels.state}</Label>
          <Input
            id={`${idPrefix}-state`}
            value={address.state}
            onChange={(event) => onChange("state", event.target.value.toUpperCase())}
          />
        </div>
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
            onChange={(event) => onChange("country", event.target.value.toUpperCase())}
          />
        </div>
      </div>
    </>
  );
}

export function CustomerForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: CustomerFormProps) {
  const [values, setValues] = useState<CustomerFormValues>(() =>
    normalizeCustomerFormValues(initialValues ?? createEmptyCustomerForm()),
  );
  const [formError, setFormError] = useState<string | null>(null);

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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          value={values.name}
          onChange={(event) => updateField("name", event.target.value)}
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
          value={normalizeCustomerType(values.customerType)}
          onChange={(event) => updateField("customerType", Number(event.target.value))}
          required
        >
          {CUSTOMER_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Senders use the USA branch; receivers use the DR branch.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone1">
            Phone 1 <span className="text-destructive">*</span>
          </Label>
          <PhoneInput
            id="phone1"
            value={values.phone1}
            onChange={(nextValue) => updateField("phone1", nextValue)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone2">Phone 2</Label>
          <PhoneInput
            id="phone2"
            value={values.phone2}
            onChange={(nextValue) => updateField("phone2", nextValue)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={values.email}
            onChange={(event) => updateField("email", event.target.value)}
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

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          value={values.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          rows={3}
          className={textareaClassName}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label>Address</Label>
          <Button type="button" variant="outline" size="sm" onClick={addAddress}>
            <Plus className="h-4 w-4" />
            Add address
          </Button>
        </div>

        <div className="space-y-4 rounded-lg border border-border/60 p-4">
          <p className="text-sm font-medium">Primary address</p>
          <AddressFieldGrid
            idPrefix="primary"
            address={values.address}
            onChange={(field, value) => updateAddressField(field, value)}
          />
        </div>

        {values.addresses.slice(1).map((address, index) => {
          const addressIndex = index + 1;

          return (
            <div key={addressIndex} className="space-y-4 rounded-lg border border-border/60 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Additional address {addressIndex}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => removeAddress(addressIndex)}
                >
                  <Trash2 className="h-4 w-4" />
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
      </div>

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
