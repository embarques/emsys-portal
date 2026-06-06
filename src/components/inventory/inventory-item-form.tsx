"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuditMetaFields } from "@/components/app-shell/audit-meta-fields";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_LOCATIONS,
  INVENTORY_STATUSES,
  createEmptyInventoryForm,
  deriveInventoryStatus,
  type InventoryFormValues,
} from "@/lib/inventory/types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type InventoryItemFormProps = {
  initialValues?: InventoryFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  onSubmit: (values: InventoryFormValues) => void;
  onCancel: () => void;
};

export function InventoryItemForm({
  initialValues,
  isEditing = false,
  updatedAt,
  submitLabel,
  onSubmit,
  onCancel,
}: InventoryItemFormProps) {
  const [values, setValues] = useState<InventoryFormValues>(initialValues ?? createEmptyInventoryForm());

  useEffect(() => {
    setValues(initialValues ?? createEmptyInventoryForm());
  }, [initialValues]);

  function updateField<K extends keyof InventoryFormValues>(key: K, value: InventoryFormValues[K]) {
    setValues((current) => {
      const next = { ...current, [key]: value };
      if (key === "quantity" || key === "reserved" || key === "reorderLevel") {
        next.status = deriveInventoryStatus(next.quantity, next.reserved, next.reorderLevel);
      }
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" value={values.sku} onChange={(event) => updateField("sku", event.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">Unit</Label>
          <Input id="unit" value={values.unit} onChange={(event) => updateField("unit", event.target.value)} required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Item name</Label>
        <Input id="name" value={values.name} onChange={(event) => updateField("name", event.target.value)} required />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            className={selectClassName}
            value={values.category}
            onChange={(event) => updateField("category", event.target.value as InventoryFormValues["category"])}
          >
            {INVENTORY_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <select
            id="location"
            className={selectClassName}
            value={values.location}
            onChange={(event) => updateField("location", event.target.value as InventoryFormValues["location"])}
          >
            {INVENTORY_LOCATIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className={selectClassName}
            value={values.status}
            onChange={(event) => updateField("status", event.target.value as InventoryFormValues["status"])}
          >
            {INVENTORY_STATUSES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="quantity">On hand</Label>
          <Input
            id="quantity"
            type="number"
            min={0}
            value={values.quantity}
            onChange={(event) => updateField("quantity", Number(event.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reserved">Reserved</Label>
          <Input
            id="reserved"
            type="number"
            min={0}
            value={values.reserved}
            onChange={(event) => updateField("reserved", Number(event.target.value))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reorderLevel">Reorder level</Label>
          <Input
            id="reorderLevel"
            type="number"
            min={0}
            value={values.reorderLevel}
            onChange={(event) => updateField("reorderLevel", Number(event.target.value))}
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
          className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder="Optional notes about stock, vendor, or recounts"
        />
      </div>

      <AuditMetaFields
        createdBy={values.createdBy}
        isEditing={isEditing}
        updatedAt={updatedAt}
        onCreatedByChange={(value) => setValues((current) => ({ ...current, createdBy: value }))}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
