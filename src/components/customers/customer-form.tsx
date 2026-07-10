"use client";

import {
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
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { PhoneListEditor } from "@/components/phones/phone-list-editor";
import { REQUIRED_PHONE_DIGITS, isCompletePhoneNumber } from "@/lib/phones/phones";
import { AddressAutocompleteInput } from "@/components/addresses/address-autocomplete-input";
import { AddressVerificationBadge } from "@/components/addresses/address-verification-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { CUSTOMER_TYPE_SENDER, isCustomerSenderType } from "@/lib/customers/customer-type";
import { useTranslation } from "@/lib/i18n";
import {
  findDominicanCity,
  getDominicanCityOptions,
  type DominicanCity,
} from "@/lib/customers/dominican-cities";
import {
  CUSTOMER_TYPE_OPTIONS,
  applyCustomerTypeBranch,
  applyPlaceToCoreAddress,
  clearCoreAddressVerification,
  coreAddressRequiresVerification,
  createEmptyCustomerCoreAddress,
  createEmptyCustomerForm,
  getDefaultCountryForPortalBranch,
  getPortalBranchForCustomerType,
  isAddressVerified,
  normalizeCustomerFormValues,
  normalizeCustomerType,
  normalizeCustomerAddresses,
  setCustomerFormPrimaryAddress,
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

/** Capitalize the first letter of every word, preserving the rest as typed. */
function capitalizeWords(value: string): string {
  return value.replace(/(^|\s)(\p{L})/gu, (_match, boundary, letter) => boundary + letter.toUpperCase());
}

function focusFormField(id: string) {
  requestAnimationFrame(() => {
    document.getElementById(id)?.focus();
  });
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
  const { t } = useTranslation();
  const labels = {
    address1: t("customers.form.addressFields.address1"),
    address2: t("customers.form.addressFields.address2"),
    crossStreet: t("customers.form.addressFields.crossStreet"),
    apartment: t("customers.form.addressFields.apartment"),
    city: t("customers.form.addressFields.city"),
    cityProvince: t("customers.form.addressFields.cityProvince"),
    state: t("customers.form.addressFields.state"),
    zipcode: t("customers.form.addressFields.zipcode"),
    country: t("customers.form.addressFields.country"),
  };
  const dash = t("common.empty.dash");

  const cityOptions =
    address.city && !CITY_DROPDOWN_OPTIONS.some((option) => option.value === address.city)
      ? [{ value: address.city, label: address.city }, ...CITY_DROPDOWN_OPTIONS]
      : CITY_DROPDOWN_OPTIONS;

  const googleEnabled = isGoogleMapsConfigured();
  // Senders use Google autocomplete to fill city/state/zip, so we render those
  // as read-only text instead of editable fields.
  const senderAutoFill = mode === "sender" && googleEnabled;

  const hasLocation = Boolean(
    address.city?.trim() ||
      address.state?.trim() ||
      address.zipcode?.trim() ||
      address.country?.trim(),
  );

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
              placeholder={t("customers.form.placeholders.streetAddress")}
            />
          ) : (
            <Input
              id={`${idPrefix}-address1`}
              value={address.address1}
              onChange={(event) => onChange("address1", event.target.value)}
              placeholder={t("customers.form.placeholders.streetAddressManual")}
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
            placeholder={t("customers.form.placeholders.apartment")}
          />
        </div>
      </div>

      {/* Cross street sits below address line 1 + apartment for both senders and receivers. */}
      <div className="space-y-1">
        <Input
          id={`${idPrefix}-cross-street`}
          value={address.address2}
          onChange={(event) => onChange("address2", event.target.value)}
          placeholder={t("customers.form.placeholders.crossStreet")}
        />
      </div>

      {senderAutoFill ? (
        <div className="space-y-1">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-city`} className="text-xs text-muted-foreground">
                {labels.city}
              </Label>
              <Input
                id={`${idPrefix}-city`}
                value={address.city}
                placeholder={dash}
                disabled
                readOnly
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-state`} className="text-xs text-muted-foreground">
                {labels.state}
              </Label>
              <Input
                id={`${idPrefix}-state`}
                value={address.state}
                placeholder={dash}
                disabled
                readOnly
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-zipcode`} className="text-xs text-muted-foreground">
                {labels.zipcode}
              </Label>
              <Input
                id={`${idPrefix}-zipcode`}
                value={address.zipcode}
                placeholder={dash}
                disabled
                readOnly
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${idPrefix}-country`} className="text-xs text-muted-foreground">
                {labels.country}
              </Label>
              <Input
                id={`${idPrefix}-country`}
                value={address.country}
                placeholder={dash}
                disabled
                readOnly
              />
            </div>
          </div>
          {!hasLocation ? (
            <p className="text-xs text-muted-foreground">
              {t("customers.form.address.googleHint")}
            </p>
          ) : null}
        </div>
      ) : mode === "receiver" ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={`${idPrefix}-city`} className="text-xs text-muted-foreground">
              {labels.cityProvince}
            </Label>
            <SearchableSelect
              id={`${idPrefix}-city`}
              value={address.city}
              searchPlaceholder={t("customers.form.placeholders.cityProvinceSearch")}
              onValueChange={(value) => {
                const match = findDominicanCity(value);
                if (match) {
                  onCitySelected(match);
                } else {
                  onChange("city", value);
                }
              }}
              options={cityOptions}
              placeholder={t("customers.form.placeholders.cityProvince")}
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
  const { t } = useTranslation();
  const [values, setValues] = useState<CustomerFormValues>(() =>
    normalizeCustomerFormValues(initialValues ?? createEmptyCustomerForm()),
  );
  const [formError, setFormError] = useState<string | null>(null);
  // The address section stays collapsed until the user adds one (or when editing
  // a customer that already has address content).
  const [showAddresses, setShowAddresses] = useState(() =>
    (initialValues?.addresses ?? []).some(coreAddressRequiresVerification),
  );
  const [pendingAddressFocusIndex, setPendingAddressFocusIndex] = useState<number | null>(null);
  const errorMessage = formError ?? externalError;
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(
      normalizeCustomerFormValues(initialValues ?? createEmptyCustomerForm()),
    );
    setShowAddresses((initialValues?.addresses ?? []).some(coreAddressRequiresVerification));
    setFormError(null);
  }, [initialValues?.id, initialValues?.updatedAt]);

  useEffect(() => {
    if (pendingAddressFocusIndex == null || !showAddresses) return;
    const input = document.getElementById(`address-${pendingAddressFocusIndex}-address1`);
    if (!input) return;
    input.focus();
    setPendingAddressFocusIndex(null);
  }, [pendingAddressFocusIndex, showAddresses, values.addresses.length]);

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
      const emptyAddress = createEmptyCustomerCoreAddress(
        getDefaultCountryForPortalBranch(getPortalBranchForCustomerType(nextType)),
        true,
      );

      return {
        ...next,
        addresses: [emptyAddress],
      };
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
    index: number,
    key: K,
    value: CustomerCoreAddress[K],
  ) {
    setValues((current) => ({
      ...current,
      addresses: current.addresses.map((entry, addressIndex) =>
        addressIndex === index ? applyAddressFieldEdit(entry, key, value) : entry,
      ),
    }));
    setFormError(null);
  }

  function applyPlaceToAddress(index: number, place: ParsedPlaceAddress) {
    setValues((current) => ({
      ...current,
      addresses: current.addresses.map((entry, addressIndex) =>
        addressIndex === index ? applyPlaceToCoreAddress(entry, place) : entry,
      ),
    }));
  }

  function applyCityToCoreAddress(
    address: CustomerCoreAddress,
    city: DominicanCity,
  ): CustomerCoreAddress {
    return { ...address, city: city.city, state: city.province };
  }

  function applyCityToAddress(index: number, city: DominicanCity) {
    setValues((current) => ({
      ...current,
      addresses: current.addresses.map((entry, addressIndex) =>
        addressIndex === index ? applyCityToCoreAddress(entry, city) : entry,
      ),
    }));
  }

  function getPrimaryAddressCountry(values: CustomerFormValues): string {
    return (
      values.addresses.find((entry) => entry.isPrimary)?.country ??
      values.addresses[0]?.country ??
      "US"
    );
  }

  function addAddress() {
    const newIndex = values.addresses.length;
    setValues((current) => ({
      ...current,
      addresses: [
        ...current.addresses,
        createEmptyCustomerCoreAddress(getPrimaryAddressCountry(current), false),
      ],
    }));
    setPendingAddressFocusIndex(newIndex);
  }

  /** Reveal the collapsed address section and focus the primary address. */
  function handleAddAddressClick() {
    if (!showAddresses) {
      setShowAddresses(true);
      const primaryIndex = Math.max(
        0,
        values.addresses.findIndex((entry) => entry.isPrimary),
      );
      setPendingAddressFocusIndex(primaryIndex < 0 ? 0 : primaryIndex);
      return;
    }
    addAddress();
  }

  function removeAddress(index: number) {
    const isLastAddress = values.addresses.length <= 1;

    setValues((current) => {
      if (current.addresses.length <= 1) {
        const empty = createEmptyCustomerCoreAddress(getPrimaryAddressCountry(current), true);
        return { ...current, addresses: [empty] };
      }

      const removedPrimary = current.addresses[index]?.isPrimary === true;
      const addresses = current.addresses
        .filter((_, addressIndex) => addressIndex !== index)
        .map((entry, addressIndex) => ({
          ...entry,
          isPrimary: removedPrimary ? addressIndex === 0 : entry.isPrimary,
        }));

      return {
        ...current,
        addresses: normalizeCustomerAddresses(addresses),
      };
    });

    if (isLastAddress) {
      setShowAddresses(false);
    }
  }

  /** Mark an address as primary without changing list order. */
  function setPrimaryAddress(index: number) {
    setValues((current) => setCustomerFormPrimaryAddress(current, index));
  }

  const isSender = isCustomerSenderType(values.customerType);
  const addressMode: "sender" | "receiver" = isSender ? "sender" : "receiver";
  const googleEnabled = isGoogleMapsConfigured();

  // The single reason the customer can't be saved yet, evaluated in priority
  // order: name → first phone → any other started phone → any open address.
  // Senders need a verified address; receivers need a city selected.
  const blockReason: string | null = (() => {
    if (!values.name.trim()) {
      return t("customers.form.validation.nameRequired");
    }

    const firstPhone = values.phones[0];
    if (!firstPhone || !firstPhone.number.trim()) {
      return t("customers.form.validation.phoneRequired");
    }
    if (!isCompletePhoneNumber(firstPhone.number)) {
      return t("customers.form.validation.phoneDigits", { index: 1, digits: REQUIRED_PHONE_DIGITS });
    }

    for (let index = 1; index < values.phones.length; index += 1) {
      const phone = values.phones[index];
      if (phone.number.trim() && !isCompletePhoneNumber(phone.number)) {
        return t("customers.form.validation.phoneDigits", {
          index: index + 1,
          digits: REQUIRED_PHONE_DIGITS,
        });
      }
    }

    if (showAddresses) {
      for (let index = 0; index < values.addresses.length; index += 1) {
        const address = values.addresses[index];
        const label = t("customers.form.address.label", { index: index + 1 });

        if (isSender) {
          if (googleEnabled) {
            if (!isAddressVerified(address)) {
              return values.addresses.length > 1
                ? t("customers.form.validation.addressGoogleVerifyNamed", { label })
                : t("customers.form.validation.addressGoogleVerify");
            }
          } else if (!coreAddressRequiresVerification(address)) {
            return t("customers.form.validation.addressCompleteOrRemove", { label });
          }
        } else if (!address.city.trim()) {
          return t("customers.form.validation.addressCityRequired", { label });
        }
      }
    }

    return null;
  })();

  /** Focus the first field that fails the same checks as `blockReason`. */
  function focusFirstInvalidField(current: CustomerFormValues = values) {
    if (!current.name.trim()) {
      focusFormField("name");
      return;
    }

    const firstPhone = current.phones[0];
    if (!firstPhone || !firstPhone.number.trim() || !isCompletePhoneNumber(firstPhone.number)) {
      focusFormField("customer-phone-number-0");
      return;
    }

    for (let index = 1; index < current.phones.length; index += 1) {
      const phone = current.phones[index];
      if (phone.number.trim() && !isCompletePhoneNumber(phone.number)) {
        focusFormField(`customer-phone-number-${index}`);
        return;
      }
    }

    if (showAddresses) {
      for (let index = 0; index < current.addresses.length; index += 1) {
        const address = current.addresses[index];

        if (isSender) {
          if (googleEnabled) {
            if (!isAddressVerified(address)) {
              focusFormField(`address-${index}-address1`);
              return;
            }
          } else if (!coreAddressRequiresVerification(address)) {
            focusFormField(`address-${index}-address1`);
            return;
          }
        } else if (!address.city.trim()) {
          focusFormField(`address-${index}-city`);
          return;
        }
      }
    }

    focusFormField("name");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const nextValues = normalizeCustomerFormValues(values);

    if (blockReason) {
      setFormError(blockReason);
      focusFirstInvalidField(nextValues);
      return;
    }

    try {
      validateCustomerFormValues(nextValues);
      setFormError(null);
      onSubmit(nextValues);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : t("customers.form.validation.saveFailed"),
      );
      focusFirstInvalidField(nextValues);
    }
  }

  const selectedType = normalizeCustomerType(values.customerType);

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
        <FormSection icon={User} title={t("customers.form.sections.general")}>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="customerType">
                {t("customers.form.fields.customerType")} <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                id="customerType"
                value={String(selectedType)}
                onValueChange={(next) => handleCustomerTypeChange(Number(next))}
                options={CUSTOMER_TYPE_OPTIONS.map((option) => ({
                  value: String(option.value),
                  label:
                    option.value === CUSTOMER_TYPE_SENDER
                      ? t("customers.types.sender")
                      : t("customers.types.receiver"),
                }))}
                disabled={lockCustomerType}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="name">
                {t("customers.form.fields.name")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={values.name}
                onChange={(event) => updateField("name", capitalizeWords(event.target.value))}
                placeholder={t("customers.form.placeholders.name")}
                autoFocus={!isEditing}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="IDNumber">{t("customers.form.fields.idNumber")}</Label>
              <Input
                id="IDNumber"
                value={values.IDNumber}
                onChange={(event) =>
                  updateField("IDNumber", event.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">{t("customers.form.fields.email")}</Label>
              <Input
                id="email"
                type="email"
                value={values.email}
                onChange={(event) => updateField("email", event.target.value)}
                placeholder={t("customers.form.placeholders.email")}
              />
            </div>
          </div>
        </FormSection>

        <FormSection icon={PhoneIcon} title={t("customers.form.sections.phones")}>
          <PhoneListEditor
            idPrefix="customer-phone"
            phones={values.phones}
            required
            compact
            onChange={(phones) => updateField("phones", phones)}
          />
        </FormSection>

        <FormSection icon={MapPin} title={t("customers.form.sections.addresses")}>
          <div className="space-y-2.5">
            {showAddresses && values.addresses.map((address, index) => {
              const isPrimary = address.isPrimary;

              return (
                <div
                  key={index}
                  className="rounded-lg border border-border/60 bg-muted/20 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("customers.form.address.label", { index: index + 1 })}
                      </p>
                      {isSender ? <AddressVerificationBadge address={address} /> : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-pressed={isPrimary}
                        title={
                          isPrimary
                            ? t("customers.form.address.primary")
                            : t("customers.form.address.setPrimary")
                        }
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
                        title={t("customers.form.address.remove")}
                        className="size-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeAddress(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <AddressFieldGrid
                    idPrefix={`address-${index}`}
                    address={address}
                    mode={addressMode}
                    onChange={(field, value) => updateAddressField(index, field, value)}
                    onPlaceSelected={(place) => applyPlaceToAddress(index, place)}
                    onCitySelected={(city) => applyCityToAddress(index, city)}
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
              {t("customers.form.address.add")}
            </Button>
          </div>
        </FormSection>

        <FormSection icon={StickyNote} title={t("customers.form.sections.notes")}>
          <Input
            id="notes"
            value={values.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder={t("customers.form.placeholders.notes")}
          />
        </FormSection>
      </FormBody>

      <FormFooter
        error={errorMessage}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  );
}
