"use client";

import { Building2, ListOrdered, PackagePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { selectFormFieldTextOnFocus, useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { FormBody, FormFooter, FormSection, FormWorkflowHints } from "@/components/forms/form-shell";
import { InventoryDocumentLinesEditor } from "@/components/inventory/inventory-document-lines-editor";
import { InventoryHolderSelect } from "@/components/inventory/inventory-holder-select";
import { InventoryItemForm } from "@/components/inventory/inventory-item-form";
import { InventorySupplierForm } from "@/components/inventory/inventory-supplier-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import { normalizeApiError } from "@/lib/api/axios";
import { useTranslation } from "@/lib/i18n";
import {
  useCreateInventoryItem,
  useCreateSupplier,
  useUpdateSupplier,
} from "@/lib/inventory/hooks/use-inventory";
import { buildInventoryReceiptPayload } from "@/lib/inventory/schemas/inventory.schema";
import type { InventoryFormValues, InventoryItem } from "@/lib/inventory/types/catalog";
import {
  createEmptyReceiptForm,
  createEmptyReceiptLine,
  type ReceiptFormValues,
} from "@/lib/inventory/types/documents";
import type { InventoryHolder } from "@/lib/inventory/types/holders";
import {
  supplierToFormValues,
  type InventorySupplier,
  type SupplierFormValues,
} from "@/lib/inventory/types/suppliers";

type EntityDialog = "item" | "supplier" | null;

const WAREHOUSE_ONLY = ["WAREHOUSE"] as const;

type InventoryReceiptFormProps = {
  items: InventoryItem[];
  suppliers: InventorySupplier[];
  holders: InventoryHolder[];
  initialValues?: ReceiptFormValues;
  submitLabel: string;
  onSubmit: (values: ReceiptFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function InventoryReceiptForm({
  items,
  suppliers,
  holders,
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InventoryReceiptFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<ReceiptFormValues>(() => initialValues ?? createEmptyReceiptForm());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [entityDialog, setEntityDialog] = useState<EntityDialog>(null);
  const [editingSupplier, setEditingSupplier] = useState<InventorySupplier | null>(null);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [createdItems, setCreatedItems] = useState<InventoryItem[]>([]);
  const [pinnedSupplierLabel, setPinnedSupplierLabel] = useState("");
  const handleEnterNavigation = useFormEnterNavigation();
  const createItem = useCreateInventoryItem();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const validation = buildInventoryReceiptPayload(values);

  const itemChoices = useMemo(
    () => [...items, ...createdItems.filter((created) => !items.some((item) => item.id === created.id))],
    [createdItems, items],
  );
  const editingSupplierValues = useMemo(
    () => (editingSupplier ? supplierToFormValues(editingSupplier) : undefined),
    [editingSupplier],
  );
  const selectedSupplier = suppliers.find((supplier) => supplier.id === values.supplierId) ?? editingSupplier;

  const supplierOptions = useMemo(
    () =>
      withPinnedSelectOption(
        suppliers
          .filter((supplier) => supplier.isActive || supplier.id === values.supplierId)
          .map((supplier) => ({
            value: supplier.id,
            label: supplier.companyName,
            keywords: supplier.contacts.flatMap((contact) => [contact.name, contact.email]),
          })),
        values.supplierId,
        pinnedSupplierLabel || selectedSupplier?.companyName,
      ),
    [pinnedSupplierLabel, selectedSupplier?.companyName, suppliers, values.supplierId],
  );

  useEffect(() => {
    setValues(initialValues ?? createEmptyReceiptForm());
    setValidationError(null);
    setPinnedSupplierLabel("");
  }, [initialValues]);

  function patch(next: Partial<ReceiptFormValues>) {
    setValues((current) => ({ ...current, ...next }));
    setValidationError(null);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validation.ok) {
      setValidationError(t(validation.error));
      return;
    }
    onSubmit(values);
  }

  async function saveItem(formValues: InventoryFormValues) {
    try {
      setEntityError(null);
      const saved = await createItem.mutateAsync(formValues);
      setCreatedItems((current) => [...current, saved]);
      setValues((current) => {
        const emptyLine = current.lines.find((line) => !line.itemId);
        return {
          ...current,
          lines: emptyLine
            ? current.lines.map((line) => (line.key === emptyLine.key ? { ...line, itemId: saved.id } : line))
            : [...current.lines, { ...createEmptyReceiptLine(), itemId: saved.id }],
        };
      });
      setEntityDialog(null);
    } catch (error) {
      setEntityError(normalizeApiError(error).message);
    }
  }

  async function saveSupplier(formValues: SupplierFormValues) {
    try {
      setEntityError(null);
      const saved = editingSupplier
        ? await updateSupplier.mutateAsync({ supplier: editingSupplier, values: formValues })
        : await createSupplier.mutateAsync(formValues);
      setPinnedSupplierLabel(saved.companyName);
      patch({ supplierId: saved.id });
      setEntityDialog(null);
      setEditingSupplier(null);
    } catch (error) {
      setEntityError(normalizeApiError(error).message);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
        <FormBody keyboardHint={false} isBusy={isSubmitting} className="@container min-h-0 space-y-5 p-4 sm:p-6">
          <FormWorkflowHints requiredHint={t("inventory.form.workflow.requiredHint")} keyboardHint={t("inventory.form.workflow.keyboardHint")} />
          <FormSection
            icon={Building2}
            title={`01 · ${t("inventory.form.sections.header")}`}
            className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <p className="text-sm text-muted-foreground">{t("inventory.form.workflow.receiptDraftHint")}</p>
            <div className="grid gap-4 @3xl:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="receipt-supplier">{t("inventory.form.fields.supplier")} <span className="text-destructive">*</span></Label>
                  <FieldEntityActions
                    hasSelection={Boolean(selectedSupplier)}
                    onAdd={() => {
                      setEditingSupplier(null);
                      setEntityError(null);
                      setEntityDialog("supplier");
                    }}
                    onEdit={() => {
                      if (!selectedSupplier) return;
                      setEditingSupplier(selectedSupplier);
                      setEntityError(null);
                      setEntityDialog("supplier");
                    }}
                    addIcon={Building2}
                  />
                </div>
                <SearchableSelect
                  id="receipt-supplier"
                  value={values.supplierId}
                  onValueChange={(supplierId) => {
                    setPinnedSupplierLabel(suppliers.find((entry) => entry.id === supplierId)?.companyName ?? "");
                    patch({ supplierId });
                  }}
                  placeholder={t("inventory.form.placeholders.supplier")}
                  searchPlaceholder={t("inventory.search.suppliers")}
                  emptyMessage={t("inventory.empty.noOptions")}
                  options={supplierOptions}
                  selectAllOnFocus
                  required
                  mobileSheet
                />
              </div>
              <InventoryHolderSelect
                id="receipt-warehouse"
                label={t("inventory.form.fields.warehouse")}
                value={values.toHolderId}
                holders={holders}
                allowedTypes={WAREHOUSE_ONLY}
                placeholder={t("inventory.form.placeholders.warehouse")}
                required
                onChange={(toHolderId) => patch({ toHolderId })}
              />
              <div className="space-y-1">
                <Label htmlFor="receipt-received-at">{t("inventory.form.fields.receivedAt")} <span className="text-destructive">*</span></Label>
                <Input
                  id="receipt-received-at"
                  type="datetime-local"
                  value={values.receivedAt}
                  onChange={(event) => patch({ receivedAt: event.target.value })}
                  onFocus={selectFormFieldTextOnFocus}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="receipt-notes">{t("inventory.form.fields.notes")}</Label>
                <Input
                  id="receipt-notes"
                  value={values.notes}
                  placeholder={t("inventory.form.placeholders.notes")}
                  onChange={(event) => patch({ notes: event.target.value })}
                  onFocus={selectFormFieldTextOnFocus}
                />
              </div>
            </div>
          </FormSection>
          <FormSection
            icon={ListOrdered}
            title={`02 · ${t("inventory.form.sections.lines")}`}
            className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm"
            action={
              <FieldEntityActions
                onAdd={() => {
                  setEntityError(null);
                  setEntityDialog("item");
                }}
                addIcon={PackagePlus}
              />
            }
          >
            <p className="text-sm text-muted-foreground">{t("inventory.form.workflow.receiptHint")}</p>
            <InventoryDocumentLinesEditor
              idPrefix="receipt"
              lines={values.lines}
              items={itemChoices}
              withUnitCost
              createLine={createEmptyReceiptLine}
              onChange={(lines) => patch({ lines })}
            />
          </FormSection>
        </FormBody>

        <FormFooter
          error={validationError}
          warning={validation.ok ? null : t(validation.error)}
          submitLabel={submitLabel}
          onCancel={onCancel}
          isSubmitting={isSubmitting}
        />
      </form>

      <Dialog open={entityDialog === "item"} onOpenChange={(open) => !open && setEntityDialog(null)}>
        <DialogContent className="z-[70] flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{t("inventory.form.addItemTitle")}</DialogTitle>
          </DialogHeader>
          <InventoryItemForm
            isSubmitting={createItem.isPending}
            submitLabel={t("inventory.actions.addItem")}
            onSubmit={saveItem}
            onCancel={() => setEntityDialog(null)}
          />
          {entityError ? <p className="px-6 pb-4 text-sm text-destructive">{entityError}</p> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={entityDialog === "supplier"} onOpenChange={(open) => !open && setEntityDialog(null)}>
        <DialogContent className="z-[70] flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>
              {editingSupplier ? t("inventory.form.editSupplierTitle") : t("inventory.form.addSupplierTitle")}
            </DialogTitle>
          </DialogHeader>
          <InventorySupplierForm
            key={editingSupplier?.id ?? "new"}
            initialValues={editingSupplierValues}
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
