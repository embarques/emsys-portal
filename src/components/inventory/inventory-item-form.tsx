"use client";

import { Boxes, StickyNote, Tag } from "lucide-react";
import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
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

const textareaClassName =
  "flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

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
      <FormBody>
        <FormSection icon={Tag} title="Identification">
          <div className="space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="sku">SKU</Label>
                <Input id="sku" value={values.sku} onChange={(event) => updateField("sku", event.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="unit">Unit</Label>
                <Input id="unit" value={values.unit} onChange={(event) => updateField("unit", event.target.value)} required />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="name">Item name</Label>
              <Input id="name" value={values.name} onChange={(event) => updateField("name", event.target.value)} required />
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="category">Category</Label>
                <SearchableSelect
                  id="category"
                  value={values.category}
                  onValueChange={(next) => updateField("category", next as InventoryFormValues["category"])}
                  searchPlaceholder="Search categories…"
                  options={INVENTORY_CATEGORIES.map((option) => ({ value: option.value, label: option.label }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="location">Location</Label>
                <SearchableSelect
                  id="location"
                  value={values.location}
                  onValueChange={(next) => updateField("location", next as InventoryFormValues["location"])}
                  searchPlaceholder="Search locations…"
                  options={INVENTORY_LOCATIONS.map((option) => ({ value: option.value, label: option.label }))}
                />
              </div>
              <div className="space-y-1">
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
          </div>
        </FormSection>

        <FormSection icon={Boxes} title="Stock levels">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="quantity">On hand</Label>
              <Input
                id="quantity"
                type="number"
                min={0}
                value={values.quantity}
                onChange={(event) => updateField("quantity", Number(event.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reserved">Reserved</Label>
              <Input
                id="reserved"
                type="number"
                min={0}
                value={values.reserved}
                onChange={(event) => updateField("reserved", Number(event.target.value))}
              />
            </div>
            <div className="space-y-1">
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
        </FormSection>

        <FormSection icon={StickyNote} title="Notes">
          <textarea
            id="notes"
            value={values.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={3}
            className={textareaClassName}
            placeholder="Optional notes about stock, vendor, or recounts"
          />
        </FormSection>
      </FormBody>

      <FormFooter submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}
