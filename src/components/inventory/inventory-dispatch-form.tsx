"use client";

import { ListOrdered, PackagePlus, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { selectFormFieldTextOnFocus, useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { InventoryDocumentLinesEditor } from "@/components/inventory/inventory-document-lines-editor";
import { InventoryHolderSelect } from "@/components/inventory/inventory-holder-select";
import { InventoryItemForm } from "@/components/inventory/inventory-item-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { normalizeApiError } from "@/lib/api/axios";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { useTranslation } from "@/lib/i18n";
import { useCreateInventoryItem, useHolderStock } from "@/lib/inventory/hooks/use-inventory";
import { buildInventoryDispatchPayload } from "@/lib/inventory/schemas/inventory.schema";
import type { InventoryFormValues, InventoryItem } from "@/lib/inventory/types/catalog";
import {
  createEmptyDispatchForm,
  createEmptyDispatchLine,
  type DispatchFormValues,
} from "@/lib/inventory/types/documents";
import { INVENTORY_CUSTODIAN_HOLDER_TYPES, type InventoryHolder } from "@/lib/inventory/types/holders";

const WAREHOUSE_ONLY = ["WAREHOUSE"] as const;

type InventoryDispatchFormProps = {
  items: InventoryItem[];
  holders: InventoryHolder[];
  initialValues?: DispatchFormValues;
  submitLabel: string;
  onSubmit: (values: DispatchFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function InventoryDispatchForm({
  items,
  holders,
  initialValues,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InventoryDispatchFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<DispatchFormValues>(() => initialValues ?? createEmptyDispatchForm());
  const [validationError, setValidationError] = useState<string | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [createdItems, setCreatedItems] = useState<InventoryItem[]>([]);
  const handleEnterNavigation = useFormEnterNavigation();
  const employeesQuery = useEmployees({ page: 1, limit: 200, sort: "name:asc" });
  const sourceStock = useHolderStock(values.fromHolderId || undefined);
  const createItem = useCreateInventoryItem();
  const validation = buildInventoryDispatchPayload(values);

  const itemChoices = useMemo(
    () => [...items, ...createdItems.filter((created) => !items.some((item) => item.id === created.id))],
    [createdItems, items],
  );

  const availableByItem = useMemo(() => {
    if (!values.fromHolderId || !sourceStock.data) return undefined;
    const available = new Map<string, number>();
    for (const balance of sourceStock.data) {
      if (balance.condition !== "AVAILABLE") continue;
      available.set(balance.itemId, (available.get(balance.itemId) ?? 0) + balance.quantityOnHand - balance.quantityReserved);
    }
    for (const line of values.lines) {
      if (line.itemId && !available.has(line.itemId)) available.set(line.itemId, 0);
    }
    return available;
  }, [sourceStock.data, values.fromHolderId, values.lines]);

  const employeeOptions = useMemo(
    () =>
      (employeesQuery.data?.items ?? [])
        .filter((employee) => employee.active || String(employee.id) === values.assigneeEmployeeId)
        .map((employee) => ({ value: String(employee.id), label: employee.name })),
    [employeesQuery.data?.items, values.assigneeEmployeeId],
  );

  useEffect(() => {
    setValues(initialValues ?? createEmptyDispatchForm());
    setValidationError(null);
  }, [initialValues]);

  function patch(next: Partial<DispatchFormValues>) {
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
            : [...current.lines, { ...createEmptyDispatchLine(), itemId: saved.id }],
        };
      });
      setItemDialogOpen(false);
    } catch (error) {
      setEntityError(normalizeApiError(error).message);
    }
  }

  const exceedsAvailable = Boolean(
    availableByItem &&
      values.lines.some((line) => {
        const requested = Number(line.quantity);
        return line.itemId && Number.isFinite(requested) && requested > (availableByItem.get(line.itemId) ?? 0);
      }),
  );
  const warning = validation.ok
    ? exceedsAvailable
      ? t("inventory.errors.insufficientStock")
      : null
    : t(validation.error);

  return (
    <>
      <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
        <FormBody workflow isBusy={isSubmitting}>
          <FormSection
            variant="card"
            icon={Truck}
            title={`01 · ${t("inventory.form.sections.header")}`}
            description={t("inventory.form.workflow.dispatchDraftHint")}
          >
            <div className="grid items-end gap-4 @xl:grid-cols-2 @4xl:grid-cols-4">
              <InventoryHolderSelect
                id="dispatch-from"
                label={t("inventory.form.fields.fromHolder")}
                value={values.fromHolderId}
                holders={holders}
                allowedTypes={WAREHOUSE_ONLY}
                placeholder={t("inventory.form.placeholders.warehouse")}
                required
                onChange={(fromHolderId) => patch({ fromHolderId })}
              />
              <InventoryHolderSelect
                id="dispatch-to"
                label={t("inventory.form.fields.toHolder")}
                value={values.toHolderId}
                holders={holders}
                allowedTypes={INVENTORY_CUSTODIAN_HOLDER_TYPES}
                excludeIds={values.fromHolderId ? [values.fromHolderId] : []}
                placeholder={t("inventory.form.placeholders.toHolder")}
                required
                onChange={(toHolderId) => patch({ toHolderId })}
              />
              <div className="space-y-1">
                <Label htmlFor="dispatch-assignee">{t("inventory.form.fields.assigneeEmployee")}</Label>
                <SearchableSelect
                  id="dispatch-assignee"
                  value={values.assigneeEmployeeId}
                  onValueChange={(assigneeEmployeeId) => patch({ assigneeEmployeeId })}
                  options={employeeOptions}
                  loading={employeesQuery.isLoading}
                  placeholder={t("inventory.form.placeholders.selectEmployee")}
                  searchPlaceholder={t("inventory.form.placeholders.searchEmployees")}
                  emptyMessage={t("inventory.empty.noOptions")}
                  loadingMessage={t("common.loading")}
                  selectAllOnFocus
                  mobileSheet
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dispatch-at">{t("inventory.form.fields.dispatchedAt")} <span className="text-destructive">*</span></Label>
                <Input
                  id="dispatch-at"
                  type="datetime-local"
                  value={values.dispatchedAt}
                  onChange={(event) => patch({ dispatchedAt: event.target.value })}
                  onFocus={selectFormFieldTextOnFocus}
                  required
                />
              </div>
              <div className="space-y-1 @xl:col-span-2 @4xl:col-span-4">
                <Label htmlFor="dispatch-notes">{t("inventory.form.fields.notes")}</Label>
                <Input
                  id="dispatch-notes"
                  value={values.notes}
                  placeholder={t("inventory.form.placeholders.notes")}
                  onChange={(event) => patch({ notes: event.target.value })}
                  onFocus={selectFormFieldTextOnFocus}
                />
              </div>
            </div>
          </FormSection>
          <FormSection
            variant="card"
            icon={ListOrdered}
            title={`02 · ${t("inventory.form.sections.lines")}`}
            description={t("inventory.form.workflow.dispatchHint")}
            action={
              <FieldEntityActions
                onAdd={() => {
                  setEntityError(null);
                  setItemDialogOpen(true);
                }}
                addIcon={PackagePlus}
              />
            }
          >
            <InventoryDocumentLinesEditor
              idPrefix="dispatch"
              lines={values.lines}
              items={itemChoices}
              availableByItem={availableByItem}
              listClassName="@4xl:max-h-[max(5rem,calc(90vh-38rem))] @4xl:overflow-y-auto"
              createLine={createEmptyDispatchLine}
              onChange={(lines) => patch({ lines })}
            />
          </FormSection>
        </FormBody>

        <FormFooter
          error={validationError}
          warning={warning}
          submitLabel={submitLabel}
          onCancel={onCancel}
          isSubmitting={isSubmitting}
        />
      </form>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="z-[70] flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>{t("inventory.form.addItemTitle")}</DialogTitle>
          </DialogHeader>
          <InventoryItemForm
            isSubmitting={createItem.isPending}
            submitLabel={t("inventory.actions.addItem")}
            onSubmit={saveItem}
            onCancel={() => setItemDialogOpen(false)}
          />
          {entityError ? <p className="px-6 pb-4 text-sm text-destructive">{entityError}</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
