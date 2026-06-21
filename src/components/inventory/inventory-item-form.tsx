"use client";

import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_LOCATIONS,
  INVENTORY_STATUSES,
  createEmptyInventoryForm,
  deriveInventoryStatus,
  type InventoryFormValues,
} from "@/lib/inventory/types";

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
  const handleEnterNavigation = useFormEnterNavigation();

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
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto bg-muted/35 px-6 py-5">
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
          <SearchableSelect
            id="category"
            value={values.category}
            onValueChange={(next) => updateField("category", next as InventoryFormValues["category"])}
            searchPlaceholder="Search categories…"
            options={INVENTORY_CATEGORIES.map((option) => ({ value: option.value, label: option.label }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <SearchableSelect
            id="location"
            value={values.location}
            onValueChange={(next) => updateField("location", next as InventoryFormValues["location"])}
            searchPlaceholder="Search locations…"
            options={INVENTORY_LOCATIONS.map((option) => ({ value: option.value, label: option.label }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <SearchableSelect
            id="status"
            value={values.status}
            onValueChange={(next) => updateField("status", next as InventoryFormValues["status"])}
            searchPlaceholder="Search statuses…"
            options={INVENTORY_STATUSES.map((option) => ({ value: option.value, label: option.label }))}
          />
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
          className="flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          placeholder="Optional notes about stock, vendor, or recounts"
        />
      </div>
      </div>

      <div className="shrink-0 border-t border-border bg-card px-6 py-4">
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit">{submitLabel}</Button>
        </div>
      </div>
    </form>
  );
}
