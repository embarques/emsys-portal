"use client";

import { Boxes, StickyNote, Tag } from "lucide-react";
import { useEffect, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useTranslation } from "@/lib/i18n";
import { getInventoryCategoryOptions, getInventoryLocationOptions } from "@/lib/inventory/display";
import {
  createEmptyInventoryForm,
  type InventoryFormValues,
} from "@/lib/inventory/types";

const textareaClassName =
  "flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type InventoryItemFormProps = {
  initialValues?: InventoryFormValues;
  isEditing?: boolean;
  currentStock?: number;
  unit?: string;
  submitLabel: string;
  onSubmit: (values: InventoryFormValues) => void;
  onCancel: () => void;
};

export function InventoryItemForm({
  initialValues,
  isEditing = false,
  currentStock,
  unit,
  submitLabel,
  onSubmit,
  onCancel,
}: InventoryItemFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<InventoryFormValues>(initialValues ?? createEmptyInventoryForm());
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyInventoryForm());
  }, [initialValues]);

  function updateField<K extends keyof InventoryFormValues>(key: K, value: InventoryFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody>
        <FormSection icon={Tag} title={t("inventory.form.sections.identification")}>
          <div className="space-y-2.5">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="sku">{t("inventory.form.fields.sku")}</Label>
                <Input id="sku" value={values.sku} onChange={(event) => updateField("sku", event.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="unit">{t("inventory.form.fields.unit")}</Label>
                <Input id="unit" value={values.unit} onChange={(event) => updateField("unit", event.target.value)} required />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="name">{t("inventory.form.fields.name")}</Label>
              <Input id="name" value={values.name} onChange={(event) => updateField("name", event.target.value)} required />
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="category">{t("inventory.form.fields.category")}</Label>
                <SearchableSelect
                  id="category"
                  value={values.category}
                  onValueChange={(next) => updateField("category", next as InventoryFormValues["category"])}
                  searchPlaceholder={t("inventory.filters.allCategories")}
                  options={getInventoryCategoryOptions(t)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="location">{t("inventory.form.fields.location")}</Label>
                <SearchableSelect
                  id="location"
                  value={values.location}
                  onValueChange={(next) => updateField("location", next as InventoryFormValues["location"])}
                  searchPlaceholder={t("inventory.filters.allLocations")}
                  options={getInventoryLocationOptions(t)}
                />
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection icon={Boxes} title={t("inventory.form.sections.stockLevels")}>
          {isEditing && currentStock !== undefined ? (
            <div className="mb-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">{t("inventory.form.fields.currentStock")}: </span>
              <span className="font-medium">
                {currentStock} {unit ?? values.unit}
              </span>
              <p className="mt-1 text-xs text-muted-foreground">{t("inventory.form.readOnlyStockHint")}</p>
            </div>
          ) : null}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="reserved">{t("inventory.form.fields.reserved")}</Label>
              <Input
                id="reserved"
                type="number"
                min={0}
                value={values.reserved}
                onChange={(event) => updateField("reserved", Number(event.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="reorderLevel">{t("inventory.form.fields.reorderLevel")}</Label>
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

        <FormSection icon={StickyNote} title={t("inventory.form.sections.notes")}>
          <textarea
            id="notes"
            value={values.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={3}
            className={textareaClassName}
            placeholder={t("inventory.form.placeholders.notes")}
          />
        </FormSection>
      </FormBody>

      <FormFooter submitLabel={submitLabel} onCancel={onCancel} />
    </form>
  );
}
