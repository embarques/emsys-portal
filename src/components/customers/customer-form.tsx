"use client";

import {
  AlertCircle,
  MapPin,
  Phone as PhoneIcon,
  Plus,
  StickyNote,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
import { PhoneListEditor } from "@/components/phones/phone-list-editor";
import { AddressAutocompleteInput } from "@/components/addresses/address-autocomplete-input";
import { AddressVerificationBadge } from "@/components/addresses/address-verification-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { isCustomerSenderType } from "@/lib/customers/customer-type";
import {
  findDominicanCity,
  getDominicanCityOptions,
  type DominicanCity,
} from "@/lib/customers/dominican-cities";
import { CUSTOMER_ADDRESS_FIELD_LABELS } from "@/lib/customers/form-labels";
import {
  CUSTOMER_TYPE_OPTIONS,
  applyCustomerTypeBranch,
  applyPlaceToCoreAddress,
  clearCoreAddressVerification,
  createEmptyCustomerCoreAddress,
  createEmptyCustomerForm,
  getUnverifiedCoreAddresses,
  normalizeCustomerFormValues,
  normalizeCustomerType,
  syncCustomerFormAddresses,
  validateCustomerFormValues,
  type CustomerCoreAddress,
  type CustomerFormValues,
  type ParsedPlaceAddress,
} from "@/lib/customers/types";

/** Manual edits to these fields invalidate a prior Google verification. */
const VERIFICATION_SENSITIVE_FIELDS: (keyof CustomerCoreAddress)[] = [
  "address1",
  "city",
  "state",
  "zipcode",
  "country",
];

const textareaClassName =
  "flex min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type CustomerFormProps = {
  initialValues?: CustomerFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  /** Lock the customer type (e.g. when adding a sender/receiver from the order form). */
  lockCustomerType?: boolean;
  onSubmit: (values: CustomerFormValues) => void | Promise<void>;
  onCancel: () => void;
};

type FormSectionProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
};

function FormSection({ icon: Icon, title, children }: FormSectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <h3 className="text-sm font-semibold leading-none text-foreground">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

type AddressFieldGridProps = {
  idPrefix: string;
  address: CustomerCoreAddress;
  /** Sender = Google autocomplete; receiver = predetermined city list. */
  mode: "sender" | "receiver";
  onChange: (field: keyof CustomerCoreAddress, value: string) => void;
  onPlaceSelected: (place: ParsedPlaceAddress) => void;
  onCitySelected: (city: DominicanCity) => void;
};

const CITY_DROPDOWN_OPTIONS = getDominicanCityOptions();

function ReadOnlyAddressInput({
  id,
  label,
  value,
  title,
}: {
  id: string;
  label: string;
  value: string;
  title: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        readOnly
        disabled
        aria-readonly
        className="bg-muted/60"
        title={title}
      />
    </div>
  );
}

function AddressFieldGrid({
  idPrefix,
  address,
  mode,
  onChange,
  onPlaceSelected,
  onCitySelected,
}: AddressFieldGridProps) {
  const labels = CUSTOMER_ADDRESS_FIELD_LABELS;

  const cityOptions =
    address.city && !CITY_DROPDOWN_OPTIONS.some((option) => option.value === address.city)
      ? [{ value: address.city, label: address.city }, ...CITY_DROPDOWN_OPTIONS]
      : CITY_DROPDOWN_OPTIONS;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-address1`}>{labels.address1}</Label>
        {mode === "sender" ? (
          <AddressAutocompleteInput
            id={`${idPrefix}-address1`}
            value={address.address1}
            onValueChange={(value) => onChange("address1", value)}
            onPlaceSelected={onPlaceSelected}
            placeholder="Start typing a street address…"
          />
        ) : (
          <Input
            id={`${idPrefix}-address1`}
            value={address.address1}
            onChange={(event) => onChange("address1", event.target.value)}
            placeholder="Street address"
          />
        )}
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

      {mode === "receiver" ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-city`}>{labels.city}</Label>
          <SearchableSelect
            id={`${idPrefix}-city`}
            value={address.city}
            onValueChange={(value) => {
              const match = findDominicanCity(value);
              if (match) {
                onCitySelected(match);
              } else {
                onChange("city", value);
              }
            }}
            options={cityOptions}
            placeholder="Select a city"
            searchPlaceholder="Search city…"
          />
        </div>
      ) : (
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
              onChange={(event) =>
                onChange("state", event.target.value.toUpperCase())
              }
            />
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-zipcode`}>{labels.zipcode}</Label>
          <Input
            id={`${idPrefix}-zipcode`}
            value={address.zipcode}
            onChange={(event) => onChange("zipcode", event.target.value)}
          />
        </div>
        {mode === "receiver" ? (
          <ReadOnlyAddressInput
            id={`${idPrefix}-state`}
            label={labels.state}
            value={address.state}
            title="Province is set automatically by the selected city"
          />
        ) : (
          <ReadOnlyAddressInput
            id={`${idPrefix}-country`}
            label={labels.country}
            value={address.country}
            title="Country is set automatically by the customer type"
          />
        )}
      </div>

      {mode === "receiver" ? (
        <ReadOnlyAddressInput
          id={`${idPrefix}-country`}
          label={labels.country}
          value={address.country}
          title="Country is set automatically by the customer type"
        />
      ) : null}
    </div>
  );
}

export function CustomerForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  lockCustomerType = false,
  onSubmit,
  onCancel,
}: CustomerFormProps) {
  const [values, setValues] = useState<CustomerFormValues>(() =>
    normalizeCustomerFormValues(initialValues ?? createEmptyCustomerForm()),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const errorMessage = formError ?? externalError;
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(
      normalizeCustomerFormValues(initialValues ?? createEmptyCustomerForm()),
    );
    setFormError(null);
  }, [initialValues?.id, initialValues?.updatedAt]);

  function updateField<K extends keyof CustomerFormValues>(
    key: K,
    value: CustomerFormValues[K],
  ) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      return key === "customerType" ? applyCustomerTypeBranch(next) : next;
    });
    setFormError(null);
  }

  function applyAddressFieldEdit<K extends keyof CustomerCoreAddress>(
    address: CustomerCoreAddress,
    key: K,
    value: CustomerCoreAddress[K],
  ): CustomerCoreAddress {
    const next = { ...address, [key]: value };
    return VERIFICATION_SENSITIVE_FIELDS.includes(key)
      ? clearCoreAddressVerification(next)
      : next;
  }

  function updateAddressField<K extends keyof CustomerCoreAddress>(
    key: K,
    value: CustomerCoreAddress[K],
  ) {
    setValues((current) =>
      syncCustomerFormAddresses({
        ...current,
        address: applyAddressFieldEdit(current.address, key, value),
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
        addressIndex === index ? applyAddressFieldEdit(entry, key, value) : entry,
      );

      return syncCustomerFormAddresses({ ...current, addresses });
    });
  }

  function applyPlaceToPrimaryAddress(place: ParsedPlaceAddress) {
    setValues((current) =>
      syncCustomerFormAddresses({
        ...current,
        address: applyPlaceToCoreAddress(current.address, place),
      }),
    );
  }

  function applyPlaceToAdditionalAddress(index: number, place: ParsedPlaceAddress) {
    setValues((current) => {
      const addresses = current.addresses.map((entry, addressIndex) =>
        addressIndex === index ? applyPlaceToCoreAddress(entry, place) : entry,
      );

      return syncCustomerFormAddresses({ ...current, addresses });
    });
  }

  function applyCityToCoreAddress(
    address: CustomerCoreAddress,
    city: DominicanCity,
  ): CustomerCoreAddress {
    return { ...address, city: city.city, state: city.province };
  }

  function applyCityToPrimaryAddress(city: DominicanCity) {
    setValues((current) =>
      syncCustomerFormAddresses({
        ...current,
        address: applyCityToCoreAddress(current.address, city),
      }),
    );
  }

  function applyCityToAdditionalAddress(index: number, city: DominicanCity) {
    setValues((current) => {
      const addresses = current.addresses.map((entry, addressIndex) =>
        addressIndex === index ? applyCityToCoreAddress(entry, city) : entry,
      );

      return syncCustomerFormAddresses({ ...current, addresses });
    });
  }

  function addAddress() {
    setValues((current) =>
      syncCustomerFormAddresses({
        ...current,
        addresses: [
          ...current.addresses,
          createEmptyCustomerCoreAddress(current.address.country),
        ],
      }),
    );
  }

  function removeAddress(index: number) {
    if (index <= 0) return;

    setValues((current) =>
      syncCustomerFormAddresses({
        ...current,
        addresses: current.addresses.filter(
          (_, addressIndex) => addressIndex !== index,
        ),
      }),
    );
  }

  const isSender = isCustomerSenderType(values.customerType);
  const addressMode: "sender" | "receiver" = isSender ? "sender" : "receiver";

  const unverifiedAddresses = useMemo(
    () => getUnverifiedCoreAddresses([values.address, ...values.addresses.slice(1)]),
    [values.address, values.addresses],
  );
  // Verification only applies to senders (Google). Receivers use a city list,
  // and we only enforce when Google autocomplete is actually available.
  const blockForUnverifiedAddress =
    isSender && isGoogleMapsConfigured() && unverifiedAddresses.length > 0;
  const unverifiedAddressMessage =
    "Verify every address with a Google suggestion before saving.";

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const nextValues = normalizeCustomerFormValues(
      syncCustomerFormAddresses(values),
    );

    if (blockForUnverifiedAddress) {
      setFormError(unverifiedAddressMessage);
      return;
    }

    try {
      validateCustomerFormValues(nextValues);
      setFormError(null);
      onSubmit(nextValues);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to save customer.",
      );
    }
  }

  const selectedType = normalizeCustomerType(values.customerType);

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto bg-muted/35 px-6 py-5">
        <FormSection icon={User} title="General">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customerType">
                Customer type <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                id="customerType"
                value={String(selectedType)}
                onValueChange={(next) =>
                  updateField("customerType", Number(next))
                }
                options={CUSTOMER_TYPE_OPTIONS.map((option) => ({
                  value: String(option.value),
                  label: option.label,
                }))}
                disabled={lockCustomerType}
                required
              />
            </div>

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
              <Label htmlFor="IDNumber">ID number</Label>
              <Input
                id="IDNumber"
                value={values.IDNumber}
                onChange={(event) =>
                  updateField("IDNumber", event.target.value)
                }
              />
            </div>

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
          </div>
        </FormSection>

        <div className="border-t border-border/60" />

        <FormSection icon={StickyNote} title="Notes">
          <textarea
            id="notes"
            value={values.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={3}
            className={textareaClassName}
            placeholder="Add any relevant context…"
          />
        </FormSection>

        <div className="border-t border-border/60" />

        <FormSection icon={PhoneIcon} title="Phones">
          <PhoneListEditor
            idPrefix="customer-phone"
            phones={values.phones}
            required
            onChange={(phones) => updateField("phones", phones)}
          />
        </FormSection>

        <div className="border-t border-border/60" />

        <FormSection icon={MapPin} title="Addresses">
          <div className="space-y-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Primary address
                </p>
                {isSender ? <AddressVerificationBadge address={values.address} /> : null}
              </div>
              <AddressFieldGrid
                idPrefix="primary"
                address={values.address}
                mode={addressMode}
                onChange={(field, value) => updateAddressField(field, value)}
                onPlaceSelected={applyPlaceToPrimaryAddress}
                onCitySelected={applyCityToPrimaryAddress}
              />
            </div>

            {values.addresses.slice(1).map((address, index) => {
              const addressIndex = index + 1;

              return (
                <div
                  key={addressIndex}
                  className="rounded-lg border border-border/60 bg-muted/20 p-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Additional address {addressIndex}
                      </p>
                      {isSender ? <AddressVerificationBadge address={address} /> : null}
                    </div>
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
                    mode={addressMode}
                    onChange={(field, value) =>
                      updateAdditionalAddressField(addressIndex, field, value)
                    }
                    onPlaceSelected={(place) =>
                      applyPlaceToAdditionalAddress(addressIndex, place)
                    }
                    onCitySelected={(city) =>
                      applyCityToAdditionalAddress(addressIndex, city)
                    }
                  />
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
              onClick={addAddress}
            >
              <Plus className="size-4" />
              Add another address
            </Button>
          </div>
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
        {!errorMessage && blockForUnverifiedAddress ? (
          <p className="mb-3 text-sm text-amber-700 dark:text-amber-300">
            {unverifiedAddressMessage}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || blockForUnverifiedAddress}
            title={blockForUnverifiedAddress ? unverifiedAddressMessage : undefined}
          >
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
