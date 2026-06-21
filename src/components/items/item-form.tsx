"use client";

import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createEmptyItemForm, type ItemFormValues } from "@/lib/items/types";

const textareaClassName =
  "flex min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type ItemFormProps = {
  initialValues?: ItemFormValues;
  isEditing?: boolean;
  updatedAt?: string;
  submitLabel: string;
  externalError?: string | null;
  onSubmit: (values: ItemFormValues) => void;
  onCancel: () => void;
};

export function ItemForm({
  initialValues,
  isEditing = false,
  updatedAt,
  submitLabel,
  externalError = null,
  onSubmit,
  onCancel,
}: ItemFormProps) {
  const [values, setValues] = useState<ItemFormValues>(initialValues ?? createEmptyItemForm());
  const handleEnterNavigation = useFormEnterNavigation();

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
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto bg-muted/35 px-6 py-5">
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

      </div>

      <div className="shrink-0 border-t border-border bg-card px-6 py-4">
        {externalError ? (
          <p className="mb-3 text-sm text-destructive">{externalError}</p>
        ) : null}
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
