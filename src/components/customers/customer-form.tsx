"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAuditDate } from "@/lib/audit/display";
import {
  CUSTOMER_ACTIVE_OPTIONS,
  CUSTOMER_PORTAL_BRANCHES,
  CUSTOMER_TYPE_OPTIONS,
  createCustomerBranchFromPortal,
  createEmptyCustomerForm,
  getCustomerPortalBranch,
  type CustomerCoreAddress,
  type CustomerFormValues,
  type CustomerPortalBranch,
} from "@/lib/customers/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type CustomerFormProps = {
  initialValues?: CustomerFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  onSubmit: (values: CustomerFormValues) => void | Promise<void>;
  onCancel: () => void;
};

export function CustomerForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: CustomerFormProps) {
  const [values, setValues] = useState<CustomerFormValues>(initialValues ?? createEmptyCustomerForm());

  useEffect(() => {
    setValues(initialValues ?? createEmptyCustomerForm());
  }, [initialValues]);

  const selectedPortalBranch = getCustomerPortalBranch({ branch: values.branch, address: values.address });

  function updateField<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function updateAddressField<K extends keyof CustomerCoreAddress>(key: K, value: CustomerCoreAddress[K]) {
    setValues((current) => ({
      ...current,
      address: { ...current.address, [key]: value },
    }));
  }

  function updateBranchPortal(portal: CustomerPortalBranch) {
    const template = createCustomerBranchFromPortal(portal);
    setValues((current) => ({
      ...current,
      branch: template,
      address: {
        ...current.address,
        country: template.address.country,
      },
    }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="id">id</Label>
        <Input
          id="id"
          value={values.id || "Assigned after save"}
          readOnly
          className="bg-muted/40 font-mono text-xs"
        />
      </div>

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

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="active">active</Label>
          <select
            id="active"
            className={selectClassName}
            value={values.active ? "true" : "false"}
            onChange={(event) => updateField("active", event.target.value === "true")}
          >
            {CUSTOMER_ACTIVE_OPTIONS.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customerType">customerType</Label>
          <select
            id="customerType"
            className={selectClassName}
            value={values.customerType ?? ""}
            onChange={(event) =>
              updateField("customerType", event.target.value ? Number(event.target.value) : null)
            }
          >
            <option value="">None</option>
            {CUSTOMER_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="branch">branch</Label>
        <select
          id="branch"
          className={selectClassName}
          value={selectedPortalBranch}
          onChange={(event) => updateBranchPortal(event.target.value as CustomerPortalBranch)}
        >
          {CUSTOMER_PORTAL_BRANCHES.map((option) => (
            <option key={option.portal} value={option.portal}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone1">phone1</Label>
          <Input
            id="phone1"
            value={values.phone1}
            onChange={(event) => updateField("phone1", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone2">phone2</Label>
          <Input
            id="phone2"
            value={values.phone2}
            onChange={(event) => updateField("phone2", event.target.value)}
          />
        </div>
      </div>

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

      {isEditing ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="oldID">oldID</Label>
            <Input id="oldID" value={values.oldID > 0 ? String(values.oldID) : "—"} readOnly className="bg-muted/40" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="createdByID">createdByID</Label>
            <Input
              id="createdByID"
              value={values.createdByID != null ? String(values.createdByID) : "—"}
              readOnly
              className="bg-muted/40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="createdAt">createdAt</Label>
            <Input
              id="createdAt"
              value={values.createdAt ? formatAuditDate(values.createdAt) : "—"}
              readOnly
              className="bg-muted/40"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="updatedAt">updatedAt</Label>
            <Input
              id="updatedAt"
              value={values.updatedAt ? formatAuditDate(values.updatedAt) : "—"}
              readOnly
              className="bg-muted/40"
            />
          </div>
        </div>
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
