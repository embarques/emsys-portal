"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAddressLine } from "@/lib/customers/display";
import type { Customer } from "@/lib/customers/types";
import {
  createEmptyOrderPartyAddress,
  createEmptyOrderPartyPhone,
  type OrderPartyAddressFormValues,
  type OrderPartyFormValues,
  type OrderPartyPhoneFormValues,
} from "@/lib/orders/types";
import { cn } from "@/lib/utils";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type OrderPartyEditorProps = {
  title: string;
  description?: string;
  values: OrderPartyFormValues;
  customers: Customer[];
  customerFilter?: "sender" | "receiver" | "all";
  onChange: (values: OrderPartyFormValues) => void;
  onRemove?: () => void;
};

export function customerToOrderPartyFormValues(customer: Customer): OrderPartyFormValues {
  const addresses =
    customer.addresses.length > 0
      ? customer.addresses.map((address) => ({
          id: address.id,
          streetAddress: address.streetAddress,
          apt: address.apt ?? "",
          crossStreet: address.crossStreet ?? "",
          city: address.city,
          state: address.state ?? "",
          provinceCountry: address.provinceCountry ?? "",
          zipCode: address.zipCode ?? "",
        }))
      : [createEmptyOrderPartyAddress()];

  const primaryAddress =
    customer.addresses.find((address) => address.isPrimary) ?? customer.addresses[0] ?? addresses[0];

  return {
    id: crypto.randomUUID(),
    clientId: customer.clientId,
    name: customer.name,
    documentId: customer.documentId ?? "",
    email: customer.email ?? "",
    phones:
      customer.phones.length > 0
        ? customer.phones.map((phone) => ({
            id: phone.id,
            number: phone.number,
            label: phone.label ?? "",
          }))
        : [createEmptyOrderPartyPhone()],
    addresses,
    orderAddressId: primaryAddress?.id ?? addresses[0].id,
  };
}

export function OrderPartyEditor({
  title,
  description,
  values,
  customers,
  customerFilter = "all",
  onChange,
  onRemove,
}: OrderPartyEditorProps) {
  const filteredCustomers = customers.filter((customer) => {
    if (customerFilter === "all") return true;
    return customer.clientType === customerFilter;
  });

  function updateField<K extends keyof OrderPartyFormValues>(key: K, value: OrderPartyFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  function updatePhone(index: number, patch: Partial<OrderPartyPhoneFormValues>) {
    onChange({
      ...values,
      phones: values.phones.map((phone, phoneIndex) => (phoneIndex === index ? { ...phone, ...patch } : phone)),
    });
  }

  function addPhone() {
    onChange({ ...values, phones: [...values.phones, createEmptyOrderPartyPhone()] });
  }

  function removePhone(index: number) {
    if (values.phones.length <= 1) return;
    onChange({ ...values, phones: values.phones.filter((_, phoneIndex) => phoneIndex !== index) });
  }

  function updateAddress(index: number, patch: Partial<OrderPartyAddressFormValues>) {
    onChange({
      ...values,
      addresses: values.addresses.map((address, addressIndex) =>
        addressIndex === index ? { ...address, ...patch } : address
      ),
    });
  }

  function addAddress() {
    const nextAddress = createEmptyOrderPartyAddress();
    onChange({
      ...values,
      addresses: [...values.addresses, nextAddress],
      orderAddressId: values.addresses.length === 0 ? nextAddress.id : values.orderAddressId,
    });
  }

  function removeAddress(index: number) {
    if (values.addresses.length <= 1) return;

    const removed = values.addresses[index];
    const nextAddresses = values.addresses.filter((_, addressIndex) => addressIndex !== index);
    const nextOrderAddressId =
      values.orderAddressId === removed.id ? nextAddresses[0]?.id ?? "" : values.orderAddressId;

    onChange({ ...values, addresses: nextAddresses, orderAddressId: nextOrderAddressId });
  }

  function loadCustomer(clientId: string) {
    const customer = customers.find((entry) => entry.clientId === clientId);
    if (!customer) return;
    onChange(customerToOrderPartyFormValues(customer));
  }

  function formatAddressPreview(address: OrderPartyAddressFormValues): string {
    return formatAddressLine({
      id: address.id,
      streetAddress: address.streetAddress,
      apt: address.apt || undefined,
      crossStreet: address.crossStreet || undefined,
      city: address.city,
      state: address.state || undefined,
      provinceCountry: address.provinceCountry || undefined,
      zipCode: address.zipCode || undefined,
      isPrimary: false,
    });
  }

  return (
    <section className="space-y-4 rounded-xl border bg-muted/10 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {onRemove ? (
          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
            Remove
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${values.id}-customer`}>Load from client directory</Label>
        <select
          id={`${values.id}-customer`}
          className={selectClassName}
          value={values.clientId}
          onChange={(event) => {
            const clientId = event.target.value;
            if (!clientId) {
              updateField("clientId", "");
              return;
            }
            loadCustomer(clientId);
          }}
        >
          <option value="">Enter manually or pick a client</option>
          {filteredCustomers.map((customer) => (
            <option key={customer.clientId} value={customer.clientId}>
              {customer.name} · {customer.clientType}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${values.id}-name`}>
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id={`${values.id}-name`}
            value={values.name}
            onChange={(event) => updateField("name", event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${values.id}-document`}>Document ID</Label>
          <Input
            id={`${values.id}-document`}
            value={values.documentId}
            onChange={(event) => updateField("documentId", event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${values.id}-email`}>Email</Label>
          <Input
            id={`${values.id}-email`}
            type="email"
            value={values.email}
            onChange={(event) => updateField("email", event.target.value)}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Phone numbers</p>
            <p className="text-xs text-muted-foreground">At least one phone is required.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addPhone}>
            <Plus className="h-4 w-4" />
            Add phone
          </Button>
        </div>

        {values.phones.map((phone, index) => (
          <div key={phone.id} className="rounded-lg border bg-background p-3">
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
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`${phone.id}-label`}>Label</Label>
                <Input
                  id={`${phone.id}-label`}
                  value={phone.label}
                  onChange={(event) => updatePhone(index, { label: event.target.value })}
                  placeholder="Mobile, office..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${phone.id}-number`}>
                  Number {index === 0 ? <span className="text-destructive">*</span> : null}
                </Label>
                <Input
                  id={`${phone.id}-number`}
                  type="tel"
                  value={phone.number}
                  onChange={(event) => updatePhone(index, { number: event.target.value })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Addresses</p>
            <p className="text-xs text-muted-foreground">Select which address applies to this order.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addAddress}>
            <Plus className="h-4 w-4" />
            Add address
          </Button>
        </div>

        {values.addresses.map((address, index) => {
          const selected = values.orderAddressId === address.id;
          const preview = formatAddressPreview(address);

          return (
            <div
              key={address.id}
              className={cn("rounded-lg border bg-background p-3", selected && "border-primary ring-1 ring-primary/20")}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <input
                    type="radio"
                    name={`${values.id}-order-address`}
                    checked={selected}
                    onChange={() => updateField("orderAddressId", address.id)}
                    className="size-4 border-input"
                  />
                  Address {index + 1}
                  {selected ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Used for order
                    </span>
                  ) : null}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={values.addresses.length <= 1}
                  onClick={() => removeAddress(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {preview !== "—" ? <p className="mb-3 text-xs text-muted-foreground">{preview}</p> : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`${address.id}-street`}>
                    Street address <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`${address.id}-street`}
                    value={address.streetAddress}
                    onChange={(event) => updateAddress(index, { streetAddress: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${address.id}-apt`}>Apt / Suite</Label>
                  <Input
                    id={`${address.id}-apt`}
                    value={address.apt}
                    onChange={(event) => updateAddress(index, { apt: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${address.id}-cross`}>Cross street</Label>
                  <Input
                    id={`${address.id}-cross`}
                    value={address.crossStreet}
                    onChange={(event) => updateAddress(index, { crossStreet: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${address.id}-city`}>
                    City <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`${address.id}-city`}
                    value={address.city}
                    onChange={(event) => updateAddress(index, { city: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${address.id}-state`}>State</Label>
                  <Input
                    id={`${address.id}-state`}
                    value={address.state}
                    onChange={(event) => updateAddress(index, { state: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${address.id}-province`}>Province / Country</Label>
                  <Input
                    id={`${address.id}-province`}
                    value={address.provinceCountry}
                    onChange={(event) => updateAddress(index, { provinceCountry: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${address.id}-zip`}>Zip code</Label>
                  <Input
                    id={`${address.id}-zip`}
                    value={address.zipCode}
                    onChange={(event) => updateAddress(index, { zipCode: event.target.value })}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
