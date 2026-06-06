"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuditMetaFields } from "@/components/app-shell/audit-meta-fields";
import { createEmptyItemForm, type ItemFormValues } from "@/lib/items/types";

const textareaClassName =
  "flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type ItemFormProps = {
  initialValues?: ItemFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  onSubmit: (values: ItemFormValues) => void;
  onCancel: () => void;
};

export function ItemForm({
  initialValues,
  isEditing = false,
  updatedAt,
  submitLabel,
  onSubmit,
  onCancel,
}: ItemFormProps) {
  const [values, setValues] = useState<ItemFormValues>(initialValues ?? createEmptyItemForm());

  useEffect(() => {
    setValues(initialValues ?? createEmptyItemForm());
  }, [initialValues]);

  function updateField<K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="itemId">Item ID</Label>
        <Input id="itemId" value={values.itemId} readOnly className="bg-muted/40 font-mono text-xs" />
        {!isEditing ? <p className="text-xs text-muted-foreground">Auto-generated ID for new items.</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          Description <span className="text-destructive">*</span>
        </Label>
        <textarea
          id="description"
          value={values.description}
          onChange={(event) => updateField("description", event.target.value)}
          rows={3}
          className={textareaClassName}
          placeholder="Describe the item..."
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="price">
          Price <span className="text-destructive">*</span>
        </Label>
        <Input
          id="price"
          type="number"
          min={0}
          step="0.01"
          value={values.price}
          onChange={(event) => updateField("price", event.target.value)}
          placeholder="0.00"
          required
        />
      </div>

      <AuditMetaFields
        createdBy={values.createdBy}
        isEditing={isEditing}
        updatedAt={updatedAt}
        onCreatedByChange={(value) => updateField("createdBy", value)}
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
