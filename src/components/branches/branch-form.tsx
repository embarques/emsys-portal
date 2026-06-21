"use client";

import { Building2, MapPin, Settings } from "lucide-react";
import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  type BranchAddress,
  type BranchFormValues,
  type BranchSettings,
  createEmptyBranchForm,
} from "@/lib/branches/types";

const BOOLEAN_OPTIONS = [
  { value: "false", label: "false" },
  { value: "true", label: "true" },
];

type BranchFormProps = {
  initialValues?: BranchFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: BranchFormValues) => void | Promise<void>;
  onCancel: () => void;
};

function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <h3 className="text-sm font-semibold leading-none text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export function BranchForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  onSubmit,
  onCancel,
}: BranchFormProps) {
  const [values, setValues] = useState<BranchFormValues>(initialValues ?? createEmptyBranchForm());
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyBranchForm());
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
      <div className="flex-1 space-y-6 overflow-y-auto bg-muted/35 px-6 py-5">
      <FormSection icon={Building2} title="Branch">
        <div className="grid gap-4 sm:grid-cols-2">
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
            <Label htmlFor="code">Code</Label>
            <Input id="code" value={values.code} onChange={(event) => updateField("code", event.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Input id="type" value={values.type} onChange={(event) => updateField("type", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">Logo URL</Label>
            <Input id="logo" value={values.logo} onChange={(event) => updateField("logo", event.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone1">Phone 1</Label>
            <PhoneInput id="phone1" value={values.phone1} onChange={(nextValue) => updateField("phone1", nextValue)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone2">Phone 2</Label>
            <PhoneInput id="phone2" value={values.phone2} onChange={(nextValue) => updateField("phone2", nextValue)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="disclaimer">Disclaimer</Label>
          <Input
            id="disclaimer"
            value={values.disclaimer}
            onChange={(event) => updateField("disclaimer", event.target.value)}
          />
        </div>
      </FormSection>

      <FormSection icon={MapPin} title="address">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="address-address1">Address line 1</Label>
            <Input
              id="address-address1"
              value={values.address.address1}
              onChange={(event) => updateAddressField("address1", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-address2">Address line 2</Label>
            <Input
              id="address-address2"
              value={values.address.address2}
              onChange={(event) => updateAddressField("address2", event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="address-apartment">Apartment / suite</Label>
            <Input
              id="address-apartment"
              value={values.address.apartment}
              onChange={(event) => updateAddressField("apartment", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-city">City</Label>
            <Input
              id="address-city"
              value={values.address.city}
              onChange={(event) => updateAddressField("city", event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="address-state">State / province</Label>
            <Input
              id="address-state"
              value={values.address.state}
              onChange={(event) => updateAddressField("state", event.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-zipcode">Zip / postal code</Label>
            <Input
              id="address-zipcode"
              value={values.address.zipcode}
              onChange={(event) => updateAddressField("zipcode", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-country">Country</Label>
            <Input
              id="address-country"
              value={values.address.country}
              onChange={(event) => updateAddressField("country", event.target.value.toUpperCase())}
            />
          </div>
        </div>
      </FormSection>

      <FormSection icon={Settings} title="settings">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-labelPrefix">Label prefix</Label>
            <Input
              id="settings-labelPrefix"
              value={values.settings.labelPrefix}
              onChange={(event) => updateSettingsField("labelPrefix", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-roundDecimalPlaces">Round decimal places</Label>
            <Input
              id="settings-roundDecimalPlaces"
              type="number"
              value={values.settings.roundDecimalPlaces}
              onChange={(event) => updateSettingsField("roundDecimalPlaces", Number(event.target.value) || 0)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-defaultLabelStatus">Default label status</Label>
            <Input
              id="settings-defaultLabelStatus"
              type="number"
              value={values.settings.defaultLabelStatus}
              onChange={(event) => updateSettingsField("defaultLabelStatus", Number(event.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-imageResampleBy">Image resample by</Label>
            <Input
              id="settings-imageResampleBy"
              type="number"
              value={values.settings.imageResampleBy}
              onChange={(event) => updateSettingsField("imageResampleBy", Number(event.target.value) || 0)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-s3Profile">S3 profile</Label>
            <Input
              id="settings-s3Profile"
              value={values.settings.s3Profile}
              onChange={(event) => updateSettingsField("s3Profile", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-s3BucketName">S3 bucket name</Label>
            <Input
              id="settings-s3BucketName"
              value={values.settings.s3BucketName}
              onChange={(event) => updateSettingsField("s3BucketName", event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-s3BucketFolder">S3 bucket folder</Label>
            <Input
              id="settings-s3BucketFolder"
              value={values.settings.s3BucketFolder}
              onChange={(event) => updateSettingsField("s3BucketFolder", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-s3ShareLinkExpireMinutes">S3 share link expiry (minutes)</Label>
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-invoiceCreatedThruIncomeStatement">
              Invoice created through income statement
            </Label>
            <SearchableSelect
              id="settings-invoiceCreatedThruIncomeStatement"
              searchable={false}
              value={values.settings.invoiceCreatedThruIncomeStatement ? "true" : "false"}
              onValueChange={(next) =>
                updateSettingsField("invoiceCreatedThruIncomeStatement", next === "true")
              }
              options={BOOLEAN_OPTIONS}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-printLabelCount">Print label count</Label>
            <SearchableSelect
              id="settings-printLabelCount"
              searchable={false}
              value={values.settings.printLabelCount ? "true" : "false"}
              onValueChange={(next) => updateSettingsField("printLabelCount", next === "true")}
              options={BOOLEAN_OPTIONS}
            />
          </div>
        </div>
      </FormSection>
      </div>

      <div className="shrink-0 border-t border-border bg-card px-6 py-4">
        {externalError ? (
          <p className="mb-3 text-sm text-destructive">{externalError}</p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
