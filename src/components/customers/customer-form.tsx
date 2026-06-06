"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuditMetaFields } from "@/components/app-shell/audit-meta-fields";
import {
  CLIENT_TYPES,
  createEmptyAddress,
  createEmptyCustomerForm,
  createEmptyPhone,
  type CustomerAddressFormValues,
  type CustomerFormValues,
  type CustomerPhoneFormValues,
} from "@/lib/customers/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const textareaClassName =
  "flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type CustomerFormProps = {
  initialValues?: CustomerFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  onSubmit: (values: CustomerFormValues) => void;
  onCancel: () => void;
};

export function CustomerForm({
  initialValues,
  isEditing = false,
  updatedAt,
  submitLabel,
  onSubmit,
  onCancel,
}: CustomerFormProps) {
  const [values, setValues] = useState<CustomerFormValues>(initialValues ?? createEmptyCustomerForm());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setValues(initialValues ?? createEmptyCustomerForm());
    setFormError(null);
  }, [initialValues]);

  function updateField<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
  }

  function updatePhone(index: number, patch: Partial<CustomerPhoneFormValues>) {
    setValues((current) => ({
      ...current,
      phones: current.phones.map((phone, phoneIndex) => (phoneIndex === index ? { ...phone, ...patch } : phone)),
    }));
    setFormError(null);
  }

  function addPhone() {
    setValues((current) => ({ ...current, phones: [...current.phones, createEmptyPhone()] }));
  }

  function removePhone(index: number) {
    setValues((current) => {
      if (current.phones.length <= 1) return current;
      return {
        ...current,
        phones: current.phones.filter((_, phoneIndex) => phoneIndex !== index),
      };
    });
  }

  function updateAddress(index: number, patch: Partial<CustomerAddressFormValues>) {
    setValues((current) => ({
      ...current,
      addresses: current.addresses.map((address, addressIndex) =>
        addressIndex === index ? { ...address, ...patch } : address
      ),
    }));
    setFormError(null);
  }

  function setPrimaryAddress(index: number) {
    setValues((current) => ({
      ...current,
      addresses: current.addresses.map((address, addressIndex) => ({
        ...address,
        isPrimary: addressIndex === index,
      })),
    }));
  }

  function addAddress() {
    setValues((current) => ({
      ...current,
      addresses: [...current.addresses, createEmptyAddress(false)],
    }));
  }

  function removeAddress(index: number) {
    setValues((current) => {
      if (current.addresses.length <= 1) return current;

      const nextAddresses = current.addresses.filter((_, addressIndex) => addressIndex !== index);
      if (!nextAddresses.some((address) => address.isPrimary)) {
        nextAddresses[0] = { ...nextAddresses[0], isPrimary: true };
      }
      return { ...current, addresses: nextAddresses };
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const validPhones = values.phones.filter((phone) => phone.number.trim());
    const validAddresses = values.addresses.filter(
      (address) => address.streetAddress.trim() && address.city.trim()
    );

    if (validPhones.length === 0) {
      setFormError("Add at least one phone number.");
      return;
    }

    if (validAddresses.length === 0) {
      setFormError("Add at least one address with street and city.");
      return;
    }

    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Client details</h3>
          <p className="text-sm text-muted-foreground">Basic identity and contact information.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input id="clientId" value={values.clientId} readOnly className="bg-muted/40 font-mono text-xs" />
            {!isEditing ? <p className="text-xs text-muted-foreground">Auto-generated UUID for new clients.</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientType">
              Client type <span className="text-destructive">*</span>
            </Label>
            <select
              id="clientType"
              className={selectClassName}
              value={values.clientType}
              onChange={(event) => updateField("clientType", event.target.value as CustomerFormValues["clientType"])}
              required
            >
              {CLIENT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="documentId">Document ID</Label>
            <Input
              id="documentId"
              value={values.documentId}
              onChange={(event) => updateField("documentId", event.target.value)}
              placeholder="Passport, cédula, tax ID..."
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="name" value={values.name} onChange={(event) => updateField("name", event.target.value)} required />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={values.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={values.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={3}
              className={textareaClassName}
              placeholder="Delivery preferences, account notes..."
            />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Phone numbers</h3>
            <p className="text-sm text-muted-foreground">At least one phone is required. Add as many as you need.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addPhone}>
            <Plus className="h-4 w-4" />
            Add phone
          </Button>
        </div>

        <div className="space-y-3">
          {values.phones.map((phone, index) => (
            <div key={phone.id} className="rounded-xl border bg-muted/10 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">Phone {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={values.phones.length <= 1}
                  onClick={() => removePhone(index)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`phone-label-${phone.id}`}>Label</Label>
                  <Input
                    id={`phone-label-${phone.id}`}
                    value={phone.label}
                    onChange={(event) => updatePhone(index, { label: event.target.value })}
                    placeholder="Mobile, office, WhatsApp..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`phone-number-${phone.id}`}>
                    Number {index === 0 ? <span className="text-destructive">*</span> : null}
                  </Label>
                  <Input
                    id={`phone-number-${phone.id}`}
                    type="tel"
                    value={phone.number}
                    onChange={(event) => updatePhone(index, { number: event.target.value })}
                    placeholder="+1 (555) 000-0000"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Addresses</h3>
            <p className="text-sm text-muted-foreground">At least one address is required. Add as many as you need.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addAddress}>
            <Plus className="h-4 w-4" />
            Add address
          </Button>
        </div>

        <div className="space-y-3">
          {values.addresses.map((address, index) => (
            <div key={address.id} className="rounded-xl border bg-muted/10 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Address {index + 1}</p>
                  {address.isPrimary ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Primary</span>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  {!address.isPrimary ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setPrimaryAddress(index)}>
                      Set as primary
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={values.addresses.length <= 1}
                    onClick={() => removeAddress(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`street-${address.id}`}>
                    Street address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`street-${address.id}`}
                    value={address.streetAddress}
                    onChange={(event) => updateAddress(index, { streetAddress: event.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`apt-${address.id}`}>Apt / Suite</Label>
                  <Input
                    id={`apt-${address.id}`}
                    value={address.apt}
                    onChange={(event) => updateAddress(index, { apt: event.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`cross-${address.id}`}>Cross street</Label>
                  <Input
                    id={`cross-${address.id}`}
                    value={address.crossStreet}
                    onChange={(event) => updateAddress(index, { crossStreet: event.target.value })}
                    placeholder="Reference or intersection"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`city-${address.id}`}>
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`city-${address.id}`}
                    value={address.city}
                    onChange={(event) => updateAddress(index, { city: event.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`state-${address.id}`}>State</Label>
                  <Input
                    id={`state-${address.id}`}
                    value={address.state}
                    onChange={(event) => updateAddress(index, { state: event.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`province-${address.id}`}>Province / Country</Label>
                  <Input
                    id={`province-${address.id}`}
                    value={address.provinceCountry}
                    onChange={(event) => updateAddress(index, { provinceCountry: event.target.value })}
                    placeholder="e.g. Distrito Nacional, RD"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`zip-${address.id}`}>Zip code</Label>
                  <Input
                    id={`zip-${address.id}`}
                    value={address.zipCode}
                    onChange={(event) => updateAddress(index, { zipCode: event.target.value })}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <AuditMetaFields
        createdBy={values.createdBy}
        isEditing={isEditing}
        updatedAt={updatedAt}
        onCreatedByChange={(value) => updateField("createdBy", value)}
      />

      {formError ? <p className="text-sm text-destructive">{formError}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
