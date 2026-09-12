"use client";

import { Building2, MapPin, Phone, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { AddressAutocompleteInput } from "@/components/addresses/address-autocomplete-input";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { PhoneListEditor } from "@/components/phones/phone-list-editor";
import { useTranslation } from "@/lib/i18n";
import { isGoogleMapsConfigured } from "@/lib/maps/load-google-maps";
import {
  type BranchAddress,
  type BranchFormValues,
  type BranchSettings,
  createEmptyBranchForm,
} from "@/lib/branches/types";
import type { ParsedPlaceAddress } from "@/lib/customers/types";

type BranchFormProps = {
  initialValues?: BranchFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: BranchFormValues) => void | Promise<void>;
  onCancel: () => void;
};

export function BranchForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  onSubmit,
  onCancel,
}: BranchFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<BranchFormValues>(initialValues ?? createEmptyBranchForm());
  const [manualAddressEntry, setManualAddressEntry] = useState(false);
  const handleEnterNavigation = useFormEnterNavigation();

  const booleanOptions = useMemo(
    () => [
      { value: "false", label: t("branches.enums.boolean.false") },
      { value: "true", label: t("branches.enums.boolean.true") },
    ],
    [t],
  );

  useEffect(() => {
    setValues(initialValues ?? createEmptyBranchForm());
    setManualAddressEntry(false);
  }, [initialValues]);

  function updateField<K extends keyof BranchFormValues>(key: K, value: BranchFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateAddressField<K extends keyof BranchAddress>(key: K, value: BranchAddress[K]) {
    setValues((current) => ({
      ...current,
      address: { ...current.address, [key]: value },
    }));
  }

  function applyPlaceToAddress(place: ParsedPlaceAddress) {
    setValues((current) => ({
      ...current,
      address: {
        ...current.address,
        address1: place.address1 || current.address.address1,
        city: place.city || current.address.city,
        state: place.state || current.address.state,
        zipcode: place.zipcode || current.address.zipcode,
        country: place.country || current.address.country,
      },
    }));
  }

  function updateSettingsField<K extends keyof BranchSettings>(key: K, value: BranchSettings[K]) {
    setValues((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
    }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
        <FormSection icon={Building2} title={t("branches.form.sections.branch")}>
          <div className="space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="min-w-0 w-full flex-1 space-y-1">
                <Label htmlFor="name">
                  {t("branches.form.fields.name")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={values.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  required
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="code">{t("branches.form.fields.code")}</Label>
                <Input id="code" value={values.code} onChange={(event) => updateField("code", event.target.value)} />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="type">{t("branches.form.fields.type")}</Label>
                <Input id="type" value={values.type} onChange={(event) => updateField("type", event.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="logo">{t("branches.form.fields.logo")}</Label>
                <Input id="logo" value={values.logo} onChange={(event) => updateField("logo", event.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="disclaimer">{t("branches.form.fields.disclaimer")}</Label>
              <Input
                id="disclaimer"
                value={values.disclaimer}
                onChange={(event) => updateField("disclaimer", event.target.value)}
              />
            </div>
          </div>
        </FormSection>

        <FormSection
          icon={MapPin}
          title={t("branches.form.sections.address")}
          action={
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={() => setManualAddressEntry((current) => !current)}
            >
              {manualAddressEntry ? t("common.address.useGoogle") : t("common.address.useManual")}
            </button>
          }
        >
          <div className="space-y-2.5">
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="address-address1" className="text-xs text-muted-foreground">
                  {t("branches.form.fields.address1")}
                </Label>
                <AddressAutocompleteInput
                  id="address-address1"
                  value={values.address.address1}
                  onValueChange={(value) => updateAddressField("address1", value)}
                  onPlaceSelected={applyPlaceToAddress}
                  placeholder={t("branches.form.fields.address1")}
                  allowManualEntry
                  className="w-full"
                  onManualEntryChange={setManualAddressEntry}
                  manualEntry={manualAddressEntry}
                  manualEntryTogglePosition="none"
                />
              </div>
              <div className="w-24 shrink-0 space-y-1 sm:w-32">
                <Label htmlFor="address-apartment" className="text-xs text-muted-foreground">
                  {t("branches.form.fields.apartment")}
                </Label>
                <Input
                  id="address-apartment"
                  value={values.address.apartment}
                  onChange={(event) => updateAddressField("apartment", event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Input
                id="address-address2"
                value={values.address.address2}
                onChange={(event) => updateAddressField("address2", event.target.value)}
                placeholder={t("branches.form.fields.address2")}
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="space-y-1">
                <Label htmlFor="address-city" className="text-xs text-muted-foreground">
                  {t("branches.form.fields.city")}
                </Label>
                <Input
                  id="address-city"
                  value={values.address.city}
                  onChange={(event) => updateAddressField("city", event.target.value)}
                  disabled={isGoogleMapsConfigured() && !manualAddressEntry}
                  readOnly={isGoogleMapsConfigured() && !manualAddressEntry}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address-state" className="text-xs text-muted-foreground">
                  {t("branches.form.fields.state")}
                </Label>
                <Input
                  id="address-state"
                  value={values.address.state}
                  onChange={(event) => updateAddressField("state", event.target.value.toUpperCase())}
                  disabled={isGoogleMapsConfigured() && !manualAddressEntry}
                  readOnly={isGoogleMapsConfigured() && !manualAddressEntry}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address-zipcode" className="text-xs text-muted-foreground">
                  {t("branches.form.fields.zipcode")}
                </Label>
                <Input
                  id="address-zipcode"
                  value={values.address.zipcode}
                  onChange={(event) => updateAddressField("zipcode", event.target.value)}
                  disabled={isGoogleMapsConfigured() && !manualAddressEntry}
                  readOnly={isGoogleMapsConfigured() && !manualAddressEntry}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address-country" className="text-xs text-muted-foreground">
                  {t("branches.form.fields.country")}
                </Label>
                <Input
                  id="address-country"
                  value={values.address.country}
                  onChange={(event) => updateAddressField("country", event.target.value.toUpperCase())}
                  disabled={isGoogleMapsConfigured() && !manualAddressEntry}
                  readOnly={isGoogleMapsConfigured() && !manualAddressEntry}
                />
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection icon={Phone} title={t("branches.form.sections.contact")}>
          <div className="space-y-1">
            <Label>{t("branches.form.fields.phones")}</Label>
            <PhoneListEditor
              idPrefix="branch-phone"
              compact
              phones={values.phones}
              onChange={(phones) => updateField("phones", phones)}
            />
          </div>
        </FormSection>

        <FormSection icon={Settings} title={t("branches.form.sections.settings")}>
          <div className="space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="settings-labelPrefix">{t("branches.form.fields.labelPrefix")}</Label>
                <Input
                  id="settings-labelPrefix"
                  value={values.settings.labelPrefix}
                  onChange={(event) => updateSettingsField("labelPrefix", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="settings-roundDecimalPlaces">{t("branches.form.fields.roundDecimalPlaces")}</Label>
                <Input
                  id="settings-roundDecimalPlaces"
                  type="number"
                  value={values.settings.roundDecimalPlaces}
                  onChange={(event) => updateSettingsField("roundDecimalPlaces", Number(event.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="settings-defaultLabelStatus">{t("branches.form.fields.defaultLabelStatus")}</Label>
                <Input
                  id="settings-defaultLabelStatus"
                  type="number"
                  value={values.settings.defaultLabelStatus}
                  onChange={(event) => updateSettingsField("defaultLabelStatus", Number(event.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="settings-imageResampleBy">{t("branches.form.fields.imageResampleBy")}</Label>
                <Input
                  id="settings-imageResampleBy"
                  type="number"
                  value={values.settings.imageResampleBy}
                  onChange={(event) => updateSettingsField("imageResampleBy", Number(event.target.value) || 0)}
                />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="settings-s3Profile">{t("branches.form.fields.s3Profile")}</Label>
                <Input
                  id="settings-s3Profile"
                  value={values.settings.s3Profile}
                  onChange={(event) => updateSettingsField("s3Profile", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="settings-s3BucketName">{t("branches.form.fields.s3BucketName")}</Label>
                <Input
                  id="settings-s3BucketName"
                  value={values.settings.s3BucketName}
                  onChange={(event) => updateSettingsField("s3BucketName", event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="settings-s3BucketFolder">{t("branches.form.fields.s3BucketFolder")}</Label>
                <Input
                  id="settings-s3BucketFolder"
                  value={values.settings.s3BucketFolder}
                  onChange={(event) => updateSettingsField("s3BucketFolder", event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="settings-s3ShareLinkExpireMinutes">
                  {t("branches.form.fields.s3ShareLinkExpireMinutes")}
                </Label>
                <Input
                  id="settings-s3ShareLinkExpireMinutes"
                  type="number"
                  value={values.settings.s3ShareLinkExpireMinutes}
                  onChange={(event) =>
                    updateSettingsField("s3ShareLinkExpireMinutes", Number(event.target.value) || 0)
                  }
                />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="settings-invoiceCreatedThruIncomeStatement">
                  {t("branches.form.fields.invoiceCreatedThruIncomeStatement")}
                </Label>
                <SearchableSelect
                  id="settings-invoiceCreatedThruIncomeStatement"
                  value={values.settings.invoiceCreatedThruIncomeStatement ? "true" : "false"}
                  onValueChange={(next) =>
                    updateSettingsField("invoiceCreatedThruIncomeStatement", next === "true")
                  }
                  options={booleanOptions}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="settings-printLabelCount">{t("branches.form.fields.printLabelCount")}</Label>
                <SearchableSelect
                  id="settings-printLabelCount"
                  value={values.settings.printLabelCount ? "true" : "false"}
                  onValueChange={(next) => updateSettingsField("printLabelCount", next === "true")}
                  options={booleanOptions}
                />
              </div>
            </div>
          </div>
        </FormSection>
      </FormBody>

      <FormFooter
        error={externalError}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        onCancel={onCancel}
      />
    </form>
  );
}
