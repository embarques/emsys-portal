"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAuditDate } from "@/lib/audit/display";
import {
  type BranchAddress,
  type BranchFormValues,
  type BranchSettings,
  createEmptyBranchForm,
} from "@/lib/branches/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const readOnlyClassName = "bg-muted/40";

type BranchFormProps = {
  initialValues?: BranchFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: BranchFormValues) => void | Promise<void>;
  onCancel: () => void;
};

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
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
  onSubmit,
  onCancel,
}: BranchFormProps) {
  const [values, setValues] = useState<BranchFormValues>(initialValues ?? createEmptyBranchForm());

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
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormSection title="Branch" description="core.Branch identity fields.">
        <div className="space-y-2">
          <Label htmlFor="id">id</Label>
          <Input
            id="id"
            value={values.id > 0 ? String(values.id) : "Assigned after save"}
            readOnly
            className={readOnlyClassName}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">
              name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={values.name}
              onChange={(event) => updateField("name", event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">code</Label>
            <Input id="code" value={values.code} onChange={(event) => updateField("code", event.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="type">type</Label>
            <Input id="type" value={values.type} onChange={(event) => updateField("type", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logo">logo</Label>
            <Input id="logo" value={values.logo} onChange={(event) => updateField("logo", event.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone1">phone1</Label>
            <Input id="phone1" value={values.phone1} onChange={(event) => updateField("phone1", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone2">phone2</Label>
            <Input id="phone2" value={values.phone2} onChange={(event) => updateField("phone2", event.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="disclaimer">disclaimer</Label>
          <Input
            id="disclaimer"
            value={values.disclaimer}
            onChange={(event) => updateField("disclaimer", event.target.value)}
          />
        </div>
      </FormSection>

      <FormSection title="address" description="core.Address nested object.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="address-address1">address.address1</Label>
            <Input
              id="address-address1"
              value={values.address.address1}
              onChange={(event) => updateAddressField("address1", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-address2">address.address2</Label>
            <Input
              id="address-address2"
              value={values.address.address2}
              onChange={(event) => updateAddressField("address2", event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="address-apartment">address.apartment</Label>
            <Input
              id="address-apartment"
              value={values.address.apartment}
              onChange={(event) => updateAddressField("apartment", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-city">address.city</Label>
            <Input
              id="address-city"
              value={values.address.city}
              onChange={(event) => updateAddressField("city", event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="address-state">address.state</Label>
            <Input
              id="address-state"
              value={values.address.state}
              onChange={(event) => updateAddressField("state", event.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-zipcode">address.zipcode</Label>
            <Input
              id="address-zipcode"
              value={values.address.zipcode}
              onChange={(event) => updateAddressField("zipcode", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address-country">address.country</Label>
            <Input
              id="address-country"
              value={values.address.country}
              onChange={(event) => updateAddressField("country", event.target.value.toUpperCase())}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="settings" description="core.BranchSetting nested object.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-labelPrefix">settings.labelPrefix</Label>
            <Input
              id="settings-labelPrefix"
              value={values.settings.labelPrefix}
              onChange={(event) => updateSettingsField("labelPrefix", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-roundDecimalPlaces">settings.roundDecimalPlaces</Label>
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
            <Label htmlFor="settings-defaultLabelStatus">settings.defaultLabelStatus</Label>
            <Input
              id="settings-defaultLabelStatus"
              type="number"
              value={values.settings.defaultLabelStatus}
              onChange={(event) => updateSettingsField("defaultLabelStatus", Number(event.target.value) || 0)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-imageResampleBy">settings.imageResampleBy</Label>
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
            <Label htmlFor="settings-s3Profile">settings.s3Profile</Label>
            <Input
              id="settings-s3Profile"
              value={values.settings.s3Profile}
              onChange={(event) => updateSettingsField("s3Profile", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-s3BucketName">settings.s3BucketName</Label>
            <Input
              id="settings-s3BucketName"
              value={values.settings.s3BucketName}
              onChange={(event) => updateSettingsField("s3BucketName", event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-s3BucketFolder">settings.s3BucketFolder</Label>
            <Input
              id="settings-s3BucketFolder"
              value={values.settings.s3BucketFolder}
              onChange={(event) => updateSettingsField("s3BucketFolder", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-s3ShareLinkExpireMinutes">settings.s3ShareLinkExpireMinutes</Label>
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
              settings.invoiceCreatedThruIncomeStatement
            </Label>
            <select
              id="settings-invoiceCreatedThruIncomeStatement"
              className={selectClassName}
              value={values.settings.invoiceCreatedThruIncomeStatement ? "true" : "false"}
              onChange={(event) =>
                updateSettingsField("invoiceCreatedThruIncomeStatement", event.target.value === "true")
              }
            >
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-printLabelCount">settings.printLabelCount</Label>
            <select
              id="settings-printLabelCount"
              className={selectClassName}
              value={values.settings.printLabelCount ? "true" : "false"}
              onChange={(event) => updateSettingsField("printLabelCount", event.target.value === "true")}
            >
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </div>
        </div>
      </FormSection>

      {isEditing ? (
        <FormSection title="Audit">
          <div className="space-y-2">
            <Label htmlFor="created">created</Label>
            <Input
              id="created"
              value={values.created ? formatAuditDate(values.created) : "—"}
              readOnly
              className={readOnlyClassName}
            />
          </div>
        </FormSection>
      ) : null}

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
