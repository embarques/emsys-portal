"use client";

import { Building2, PackagePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { selectFormFieldTextOnFocus, useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { InventoryItemForm } from "@/components/inventory/inventory-item-form";
import { InventorySupplierForm } from "@/components/inventory/inventory-supplier-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import { getInventoryItemLabel, toDateInputValue } from "@/lib/inventory/display";
import {
  useCreateInventoryItem,
  useCreateSupplier,
  useUpdateInventoryItem,
  useUpdateSupplier,
} from "@/lib/inventory/hooks/use-inventory";
import {
  createEmptyInventoryForm,
  inventoryItemToFormValues,
  type InventoryFormValues,
  type InventoryItem,
} from "@/lib/inventory/types/catalog";
import {
  createEmptyReceiptForm,
  type ReceiptFormValues,
} from "@/lib/inventory/types/documents";
import {
  createEmptySupplierForm,
  supplierToFormValues,
  type InventorySupplier,
  type SupplierFormValues,
} from "@/lib/inventory/types/suppliers";

type EntityDialog = "item" | "supplier" | null;

type InventoryReceiptFormProps = {
  items: InventoryItem[];
  suppliers: InventorySupplier[];
  initialValues?: ReceiptFormValues;
  submitLabel: string;
  onSubmit: (values: ReceiptFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function InventoryReceiptForm({
  items,
  suppliers,
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InventoryReceiptFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<ReceiptFormValues>(createEmptyReceiptForm(toDateInputValue()));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [entityDialog, setEntityDialog] = useState<EntityDialog>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<InventorySupplier | null>(null);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [pinnedItemLabel, setPinnedItemLabel] = useState("");
  const [pinnedSupplierLabel, setPinnedSupplierLabel] = useState("");
  const handleEnterNavigation = useFormEnterNavigation();
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();

  const selectedItem = items.find((item) => item.id === values.itemId) ?? editingItem;
  const selectedSupplier =
    suppliers.find((supplier) => supplier.id === values.supplierId) ?? editingSupplier;

  const itemOptions = useMemo(
    () =>
      withPinnedSelectOption(
        items.map((item) => ({
          value: item.id,
          label: getInventoryItemLabel(item),
          keywords: [item.item],
        })),
        values.itemId,
        pinnedItemLabel || (selectedItem ? getInventoryItemLabel(selectedItem) : undefined),
      ),
    [items, pinnedItemLabel, selectedItem, values.itemId],
  );

  const supplierOptions = useMemo(
    () =>
      withPinnedSelectOption(
        suppliers.map((supplier) => ({
          value: supplier.id,
          label: supplier.companyName,
          keywords: [...supplier.contactNames, ...supplier.emails],
        })),
        values.supplierId,
        pinnedSupplierLabel || selectedSupplier?.companyName,
      ),
    [pinnedSupplierLabel, selectedSupplier?.companyName, suppliers, values.supplierId],
  );

  useEffect(() => {
    setValues(initialValues ?? createEmptyReceiptForm(toDateInputValue()));
    setValidationError(null);
    setPinnedItemLabel("");
    setPinnedSupplierLabel("");
  }, [initialValues]);

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

  function openAddItem() {
    setEditingItem(null);
    setEntityError(null);
    setEntityDialog("item");
  }

  function openEditItem() {
    if (!selectedItem) return;
    setEditingItem(selectedItem);
    setEntityError(null);
    setEntityDialog("item");
  }

  function openAddSupplier() {
    setEditingSupplier(null);
    setEntityError(null);
    setEntityDialog("supplier");
  }

  function openEditSupplier() {
    if (!selectedSupplier) return;
    setEditingSupplier(selectedSupplier);
    setEntityError(null);
    setEntityDialog("supplier");
  }

  async function saveItem(formValues: InventoryFormValues) {
    try {
      setEntityError(null);
      const saved = editingItem
        ? await updateItem.mutateAsync({ id: editingItem.id, values: formValues })
        : await createItem.mutateAsync(formValues);
      const label = getInventoryItemLabel(saved);
      setPinnedItemLabel(label);
      setValues((current) => ({ ...current, itemId: saved.id }));
      setEntityDialog(null);
      setEditingItem(null);
    } catch (error) {
      setEntityError(normalizeApiError(error).message);
    }
  }

  async function saveSupplier(formValues: SupplierFormValues) {
    try {
      setEntityError(null);
      const saved = editingSupplier
        ? await updateSupplier.mutateAsync({ id: editingSupplier.id, values: formValues })
        : await createSupplier.mutateAsync(formValues);
      setPinnedSupplierLabel(saved.companyName);
      setValues((current) => ({ ...current, supplierId: saved.id }));
      setEntityDialog(null);
      setEditingSupplier(null);
    } catch (error) {
      setEntityError(normalizeApiError(error).message);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
        <FormBody isBusy={isSubmitting}>
          <FormSection icon={PackagePlus} title={t("inventory.form.sections.received")}>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="itemId">{t("inventory.form.fields.item")}</Label>
                  <FieldEntityActions
                    hasSelection={Boolean(values.itemId)}
                    onAdd={openAddItem}
                    onEdit={openEditItem}
                    addIcon={PackagePlus}
                  />
                </div>
                <SearchableSelect
                  id="itemId"
                  value={values.itemId}
                  onValueChange={(next) => {
                    const item = items.find((entry) => entry.id === next);
                    setPinnedItemLabel(item ? getInventoryItemLabel(item) : "");
                    setValues((current) => ({ ...current, itemId: next }));
                  }}
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
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="supplierId">{t("inventory.form.fields.supplier")}</Label>
                  <FieldEntityActions
                    hasSelection={Boolean(values.supplierId)}
                    onAdd={openAddSupplier}
                    onEdit={openEditSupplier}
                    addIcon={Building2}
                  />
                </div>
                <SearchableSelect
                  id="supplierId"
                  value={values.supplierId}
                  onValueChange={(next) => {
                    const supplier = suppliers.find((entry) => entry.id === next);
                    setPinnedSupplierLabel(supplier?.companyName ?? "");
                    setValues((current) => ({ ...current, supplierId: next }));
                  }}
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

      <Dialog open={entityDialog === "item"} onOpenChange={(open) => !open && setEntityDialog(null)}>
        <DialogContent className="z-[70] flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>
              {editingItem ? t("inventory.form.editItemTitle") : t("inventory.form.addItemTitle")}
            </DialogTitle>
          </DialogHeader>
          <InventoryItemForm
            key={editingItem?.id ?? "new"}
            initialValues={editingItem ? inventoryItemToFormValues(editingItem) : createEmptyInventoryForm()}
            quantityLeft={editingItem?.quantity ?? 0}
            submitLabel={editingItem ? t("common.actions.saveChanges") : t("inventory.actions.addItem")}
            onSubmit={saveItem}
            onCancel={() => setEntityDialog(null)}
          />
          {entityError ? <p className="px-6 pb-4 text-sm text-destructive">{entityError}</p> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={entityDialog === "supplier"} onOpenChange={(open) => !open && setEntityDialog(null)}>
        <DialogContent className="z-[70] flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>
              {editingSupplier ? t("inventory.form.editSupplierTitle") : t("inventory.form.addSupplierTitle")}
            </DialogTitle>
          </DialogHeader>
          <InventorySupplierForm
            key={editingSupplier?.id ?? "new"}
            initialValues={editingSupplier ? supplierToFormValues(editingSupplier) : createEmptySupplierForm()}
            submitLabel={editingSupplier ? t("common.actions.saveChanges") : t("inventory.actions.addSupplier")}
            isSubmitting={createSupplier.isPending || updateSupplier.isPending}
            onSubmit={saveSupplier}
            onCancel={() => setEntityDialog(null)}
          />
          {entityError ? <p className="px-6 pb-4 text-sm text-destructive">{entityError}</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
