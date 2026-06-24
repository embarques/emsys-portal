"use client";

import {
  AlertCircle,
  MapPin,
  Phone as PhoneIcon,
  Plus,
  Star,
  StickyNote,
  Trash2,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
import { PhoneListEditor } from "@/components/phones/phone-list-editor";
import { REQUIRED_PHONE_DIGITS, isCompletePhoneNumber } from "@/lib/phones/phones";
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
  coreAddressRequiresVerification,
  createEmptyCustomerCoreAddress,
  createEmptyCustomerForm,
  isAddressVerified,
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
  "flex min-h-16 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/** Capitalize the first letter of every word, preserving the rest as typed. */
function capitalizeWords(value: string): string {
  return value.replace(/(^|\s)(\p{L})/gu, (_match, boundary, letter) => boundary + letter.toUpperCase());
}

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
  /** Optional control rendered on the right of the section header (e.g. an add button). */
  action?: React.ReactNode;
  children: React.ReactNode;
};

function FormSection({ icon: Icon, title, action, children }: FormSectionProps) {
  return (
    <section className="space-y-2.5">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
        </div>
        {action}
      </div>
      {children}
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

  const googleEnabled = isGoogleMapsConfigured();
  // Senders use Google autocomplete to fill city/state/zip, so we render those
  // as read-only text instead of editable fields.
  const senderAutoFill = mode === "sender" && googleEnabled;

  const cityState = [address.city, address.state]
    .filter((part) => part && part.trim())
    .join(", ");
  const locationSummary = [cityState, address.zipcode?.trim() ?? ""]
    .filter((part) => part.trim())
    .join(" ");
  const hasLocation = Boolean(locationSummary.trim() || address.country?.trim());

  return (
    <div className="space-y-2.5">
      {/* Address line 1 + apartment, side by side like the phone rows. */}
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={`${idPrefix}-address1`} className="text-xs text-muted-foreground">
            {labels.address1}
          </Label>
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
        <div className="w-24 shrink-0 space-y-1 sm:w-32">
          <Label htmlFor={`${idPrefix}-apartment`} className="text-xs text-muted-foreground">
            {labels.apartment}
          </Label>
          <Input
            id={`${idPrefix}-apartment`}
            value={address.apartment}
            onChange={(event) => onChange("apartment", event.target.value)}
            placeholder="Apt #"
          />
        </div>
      </div>

      {/* Cross street sits below address line 1 + apartment for both senders and receivers. */}
      <div className="space-y-1">
        <Input
          id={`${idPrefix}-cross-street`}
          value={address.address2}
          onChange={(event) => onChange("address2", event.target.value)}
          placeholder="Additional address information"
        />
      </div>

      {senderAutoFill ? (
        <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
          {hasLocation ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {locationSummary ? (
                <span className="font-medium text-foreground">{locationSummary}</span>
              ) : null}
              {address.country?.trim() ? (
                <span className="text-muted-foreground">· {address.country}</span>
              ) : null}
            </div>
          ) : (
            <span className="text-muted-foreground">
              Pick an address suggestion to fill city, state, and ZIP.
            </span>
          )}
        </div>
      ) : mode === "receiver" ? (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-city`} className="text-xs text-muted-foreground">
                {labels.city}
              </Label>
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
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-zipcode`} className="text-xs text-muted-foreground">
                {labels.zipcode}
              </Label>
              <Input
                id={`${idPrefix}-zipcode`}
                value={address.zipcode}
                onChange={(event) => onChange("zipcode", event.target.value)}
              />
            </div>
          </div>
          <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm">
            <span className="font-medium text-foreground">
              {address.state?.trim() ? address.state : "Province set by selected city"}
            </span>
            {address.country?.trim() ? (
              <span className="text-muted-foreground"> · {address.country}</span>
            ) : null}
          </div>
        </>
      ) : (
        // Sender without Google configured: keep editable city/state/zip inputs.
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-city`} className="text-xs text-muted-foreground">
              {labels.city}
            </Label>
            <Input
              id={`${idPrefix}-city`}
              value={address.city}
              onChange={(event) => onChange("city", event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-state`} className="text-xs text-muted-foreground">
              {labels.state}
            </Label>
            <Input
              id={`${idPrefix}-state`}
              value={address.state}
              onChange={(event) => onChange("state", event.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-zipcode`} className="text-xs text-muted-foreground">
              {labels.zipcode}
            </Label>
            <Input
              id={`${idPrefix}-zipcode`}
              value={address.zipcode}
              onChange={(event) => onChange("zipcode", event.target.value)}
            />
          </div>
        </div>
      )}
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
  // The address section stays collapsed until the user adds one (or when editing
  // a customer that already has address content).
  const [showAddresses, setShowAddresses] = useState(() =>
    (initialValues?.addresses ?? []).some(coreAddressRequiresVerification),
  );
  const errorMessage = formError ?? externalError;
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(
      normalizeCustomerFormValues(initialValues ?? createEmptyCustomerForm()),
    );
    setShowAddresses((initialValues?.addresses ?? []).some(coreAddressRequiresVerification));
    setFormError(null);
  }, [initialValues?.id, initialValues?.updatedAt]);

  function focusAddressLine1(idPrefix: string) {
    requestAnimationFrame(() => {
      document.getElementById(`${idPrefix}-address1`)?.focus();
    });
  }

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

  /**
   * Switching customer type swaps the address mode (sender Google autocomplete ↔
   * receiver city list) and country, so any previously entered address no longer
   * applies. Reset back to the collapsed, default state.
   */
  function handleCustomerTypeChange(nextType: number) {
    if (normalizeCustomerType(values.customerType) === normalizeCustomerType(nextType)) {
      return;
    }

    setValues((current) => {
      const next = applyCustomerTypeBranch({ ...current, customerType: nextType });
      const emptyAddress = createEmptyCustomerCoreAddress(next.address.country);

      return syncCustomerFormAddresses({
        ...next,
        address: emptyAddress,
        addresses: [emptyAddress],
      });
    });
    setShowAddresses(false);
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
    let newIndex = 0;
    setValues((current) => {
      newIndex = current.addresses.length;
      return syncCustomerFormAddresses({
        ...current,
        addresses: [
          ...current.addresses,
          createEmptyCustomerCoreAddress(current.address.country),
        ],
      });
    });
    focusAddressLine1(`additional-${newIndex}`);
  }

  /** Reveal the collapsed address section and focus the primary address. */
  function handleAddAddressClick() {
    if (!showAddresses) {
      setShowAddresses(true);
      focusAddressLine1("primary");
      return;
    }
    addAddress();
  }

  function removeAddress(index: number) {
    // Removing the last remaining address collapses the section back to its
    // hidden state, since addresses are optional unless one is open.
    const isLastAddress = values.addresses.length <= 1;

    setValues((current) => {
      if (current.addresses.length <= 1) {
        const empty = createEmptyCustomerCoreAddress(current.address.country);
        return syncCustomerFormAddresses({
          ...current,
          address: empty,
          addresses: [empty],
        });
      }

      const addresses = current.addresses.filter(
        (_, addressIndex) => addressIndex !== index,
      );

      return syncCustomerFormAddresses({
        ...current,
        address: { ...addresses[0] },
        addresses,
      });
    });

    if (isLastAddress) {
      setShowAddresses(false);
    }
  }

  /** Promote an address to primary by moving it to index 0. */
  function setPrimaryAddress(index: number) {
    if (index <= 0) return;

    setValues((current) => {
      const addresses = [...current.addresses];
      const [chosen] = addresses.splice(index, 1);
      addresses.unshift(chosen);

      return syncCustomerFormAddresses({
        ...current,
        address: { ...chosen },
        addresses,
      });
    });
  }

  const isSender = isCustomerSenderType(values.customerType);
  const addressMode: "sender" | "receiver" = isSender ? "sender" : "receiver";
  const googleEnabled = isGoogleMapsConfigured();

  // The single reason the customer can't be saved yet, evaluated in priority
  // order: name → first phone → any other started phone → any open address.
  // Senders need a verified address; receivers need a city selected.
  const blockReason: string | null = (() => {
    if (!values.name.trim()) {
      return "Enter the customer's name.";
    }

    const firstPhone = values.phones[0];
    if (!firstPhone || !firstPhone.number.trim()) {
      return "Enter a phone number.";
    }
    if (!isCompletePhoneNumber(firstPhone.number)) {
      return `Phone 1 must have ${REQUIRED_PHONE_DIGITS} digits.`;
    }

    for (let index = 1; index < values.phones.length; index += 1) {
      const phone = values.phones[index];
      if (phone.number.trim() && !isCompletePhoneNumber(phone.number)) {
        return `Phone ${index + 1} must have ${REQUIRED_PHONE_DIGITS} digits.`;
      }
    }

    if (showAddresses) {
      for (let index = 0; index < values.addresses.length; index += 1) {
        const address = values.addresses[index];
        const label = `Address ${index + 1}`;

        if (isSender) {
          if (googleEnabled) {
            if (!isAddressVerified(address)) {
              return `${label} must be verified with a Google suggestion.`;
            }
          } else if (!coreAddressRequiresVerification(address)) {
            return `Complete ${label} or remove it before saving.`;
          }
        } else if (!address.city.trim()) {
          return `${label} needs a city selected.`;
        }
      }
    }

    return null;
  })();

  const isBlocked = blockReason != null;

  // Single notice shown inline with the footer actions (errors take priority).
  const footerNotice: { tone: "error" | "warning"; message: string } | null = errorMessage
    ? { tone: "error", message: errorMessage }
    : blockReason
      ? { tone: "warning", message: blockReason }
      : null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const nextValues = normalizeCustomerFormValues(
      syncCustomerFormAddresses(values),
    );

    if (blockReason) {
      setFormError(blockReason);
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
      <div className="flex-1 space-y-4 overflow-y-auto bg-muted/35 px-5 py-4">
        <FormSection icon={User} title="General">
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="customerType">
                Customer type <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                id="customerType"
                value={String(selectedType)}
                onValueChange={(next) => handleCustomerTypeChange(Number(next))}
                options={CUSTOMER_TYPE_OPTIONS.map((option) => ({
                  value: String(option.value),
                  label: option.label,
                }))}
                disabled={lockCustomerType}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={values.name}
                onChange={(event) => updateField("name", capitalizeWords(event.target.value))}
                placeholder="Full name"
                autoFocus
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="IDNumber">ID number</Label>
              <Input
                id="IDNumber"
                value={values.IDNumber}
                onChange={(event) =>
                  updateField("IDNumber", event.target.value)
                }
              />
            </div>

            <div className="space-y-1">
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

        <FormSection icon={PhoneIcon} title="Phones">
          <PhoneListEditor
            idPrefix="customer-phone"
            phones={values.phones}
            required
            compact
            onChange={(phones) => updateField("phones", phones)}
          />
        </FormSection>

        <FormSection icon={MapPin} title="Addresses">
          <div className="space-y-2.5">
            {showAddresses && values.addresses.map((address, index) => {
              const isPrimary = index === 0;

              return (
                <div
                  key={index}
                  className="rounded-lg border border-border/60 bg-muted/20 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {`Address ${index + 1}`}
                      </p>
                      {isSender ? <AddressVerificationBadge address={address} /> : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-pressed={isPrimary}
                        title={isPrimary ? "Primary address" : "Set as primary"}
                        className={cn(
                          "size-7 shrink-0",
                          isPrimary
                            ? "text-amber-500 hover:text-amber-500"
                            : "text-muted-foreground",
                        )}
                        onClick={() => setPrimaryAddress(index)}
                      >
                        <Star className={cn("size-4", isPrimary && "fill-current")} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        title="Remove address"
                        className="size-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeAddress(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <AddressFieldGrid
                    idPrefix={isPrimary ? "primary" : `additional-${index}`}
                    address={address}
                    mode={addressMode}
                    onChange={(field, value) =>
                      isPrimary
                        ? updateAddressField(field, value)
                        : updateAdditionalAddressField(index, field, value)
                    }
                    onPlaceSelected={(place) =>
                      isPrimary
                        ? applyPlaceToPrimaryAddress(place)
                        : applyPlaceToAdditionalAddress(index, place)
                    }
                    onCitySelected={(city) =>
                      isPrimary
                        ? applyCityToPrimaryAddress(city)
                        : applyCityToAdditionalAddress(index, city)
                    }
                  />
                </div>
              );
            })}

            <Button
              type="button"
              variant="outline"
              className="h-9 w-full justify-center border-dashed border-primary/40 bg-card text-primary hover:bg-primary/10 hover:text-primary"
              onClick={handleAddAddressClick}
            >
              <Plus className="size-4" />
              Add address
            </Button>
          </div>
        </FormSection>

        <FormSection icon={StickyNote} title="Notes">
          <textarea
            id="notes"
            value={values.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={2}
            className={textareaClassName}
            placeholder="Add any relevant context…"
          />
        </FormSection>
      </div>

      <div className="shrink-0 border-t border-border bg-card px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          {footerNotice ? (
            footerNotice.tone === "error" ? (
              <div
                className={cn(
                  "flex min-w-0 flex-1 items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-1.5",
                  "text-sm text-destructive",
                )}
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 break-words">{footerNotice.message}</span>
              </div>
            ) : (
              <p className="min-w-0 flex-1 break-words text-sm text-amber-700 dark:text-amber-300">
                {footerNotice.message}
              </p>
            )
          ) : (
            <span className="flex-1" aria-hidden />
          )}

          <div className="flex shrink-0 items-center gap-2">
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
              disabled={isSubmitting || isBlocked}
              title={footerNotice?.message}
            >
              {isSubmitting ? "Saving…" : submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
