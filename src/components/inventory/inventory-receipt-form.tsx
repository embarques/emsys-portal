"use client";

import { PackagePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { selectFormFieldTextOnFocus, useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useTranslation } from "@/lib/i18n";
import { getInventoryItemLabel, toDateInputValue } from "@/lib/inventory/display";
import { createEmptyReceiptForm, type ReceiptFormValues } from "@/lib/inventory/types/documents";
import type { InventoryItem } from "@/lib/inventory/types/catalog";
import type { InventorySupplier } from "@/lib/inventory/types/suppliers";

type InventoryReceiptFormProps = {
  items: InventoryItem[];
  suppliers: InventorySupplier[];
  submitLabel: string;
  onSubmit: (values: ReceiptFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function InventoryReceiptForm({
  items,
  suppliers,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InventoryReceiptFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<ReceiptFormValues>(createEmptyReceiptForm(toDateInputValue()));
  const [validationError, setValidationError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();

  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        value: item.id,
        label: getInventoryItemLabel(item),
        keywords: [item.item],
      })),
    [items],
  );

  const supplierOptions = useMemo(
    () =>
      suppliers.map((supplier) => ({
        value: supplier.id,
        label: supplier.companyName,
        keywords: [...supplier.contactNames, ...supplier.emails],
      })),
    [suppliers],
  );

  useEffect(() => {
    setValues(createEmptyReceiptForm(toDateInputValue()));
    setValidationError(null);
  }, []);

  function getValidationError(): string | null {
    if (!values.itemId) return t("inventory.form.validation.itemRequired");
    if (!values.quantity.trim() || Number(values.quantity) <= 0) {
      return t("inventory.form.validation.quantityRequired");
    }
    if (!values.supplierId) return t("inventory.form.validation.supplierRequired");
    if (!values.receivedAt.trim()) return t("inventory.form.validation.dateRequired");
    return null;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const error = getValidationError();
    if (error) {
      setValidationError(error);
      return;
    }
    onSubmit({
      ...values,
      receivedAt: values.receivedAt.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
        <FormSection icon={PackagePlus} title={t("inventory.form.sections.received")}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="itemId">{t("inventory.form.fields.item")}</Label>
              <SearchableSelect
                id="itemId"
                value={values.itemId}
                onValueChange={(next) => setValues((current) => ({ ...current, itemId: next }))}
                placeholder={t("inventory.form.placeholders.item")}
                searchPlaceholder={t("inventory.search.items")}
                options={itemOptions}
                selectAllOnFocus
                required
                mobileSheet
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quantity">{t("inventory.form.fields.quantityReceived")}</Label>
              <Input
                id="quantity"
                type="number"
                min={0}
                value={values.quantity}
                onChange={(event) => setValues((current) => ({ ...current, quantity: event.target.value }))}
                onFocus={selectFormFieldTextOnFocus}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="averageCost">{t("inventory.form.fields.averageCost")}</Label>
              <Input
                id="averageCost"
                type="number"
                min={0}
                step="0.01"
                value={values.averageCost}
                onChange={(event) => setValues((current) => ({ ...current, averageCost: event.target.value }))}
                onFocus={selectFormFieldTextOnFocus}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="supplierId">{t("inventory.form.fields.supplier")}</Label>
              <SearchableSelect
                id="supplierId"
                value={values.supplierId}
                onValueChange={(next) => setValues((current) => ({ ...current, supplierId: next }))}
                placeholder={t("inventory.form.placeholders.supplier")}
                searchPlaceholder={t("inventory.search.suppliers")}
                options={supplierOptions}
                selectAllOnFocus
                required
                mobileSheet
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="receivedAt">{t("inventory.form.fields.receivedAt")}</Label>
              <Input
                id="receivedAt"
                type="date"
                value={values.receivedAt}
                onChange={(event) => setValues((current) => ({ ...current, receivedAt: event.target.value }))}
                onFocus={selectFormFieldTextOnFocus}
                required
              />
            </div>
          </div>
        </FormSection>
      </FormBody>

      <FormFooter error={validationError} submitLabel={submitLabel} onCancel={onCancel} isSubmitting={isSubmitting} />
    </form>
  );
}
