"use client";

import { PackageMinus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { selectFormFieldTextOnFocus, useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { InventoryDispatchToSelect } from "@/components/inventory/inventory-dispatch-to-select";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { useTranslation } from "@/lib/i18n";
import { getInventoryItemLabel, toDateInputValue } from "@/lib/inventory/display";
import { getItemStock } from "@/lib/inventory/mock-store";
import { createEmptyDispatchForm, type DispatchFormValues } from "@/lib/inventory/types/documents";
import type { InventoryItem } from "@/lib/inventory/types/catalog";
import { useDailyRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";

type InventoryDispatchFormProps = {
  items: InventoryItem[];
  submitLabel: string;
  onSubmit: (values: DispatchFormValues) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function InventoryDispatchForm({
  items,
  submitLabel,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: InventoryDispatchFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<DispatchFormValues>(createEmptyDispatchForm(toDateInputValue()));
  const [validationError, setValidationError] = useState<string | null>(null);
  const handleEnterNavigation = useFormEnterNavigation();
  const employeesQuery = useEmployees({ page: 1, limit: 200, sort: "name:asc" });
  const dailyRoutesQuery = useDailyRoutePicker(200);
  const employees = useMemo(
    () => (employeesQuery.data?.items ?? []).filter((employee) => employee.active),
    [employeesQuery.data?.items],
  );
  const dailyRoutes = dailyRoutesQuery.data?.items ?? [];

  const itemOptions = useMemo(
    () =>
      items.map((item) => ({
        value: item.id,
        label: getInventoryItemLabel(item),
        keywords: [item.item],
      })),
    [items],
  );

  useEffect(() => {
    setValues(createEmptyDispatchForm(toDateInputValue()));
    setValidationError(null);
  }, []);

  const available = values.itemId ? getItemStock(values.itemId) : 0;

  function getValidationError(): string | null {
    if (!values.itemId) return t("inventory.form.validation.itemRequired");
    if (!values.quantity.trim() || Number(values.quantity) <= 0) {
      return t("inventory.form.validation.quantityRequired");
    }
    if (!values.dispatchedAt.trim()) return t("inventory.form.validation.dateRequired");
    if (values.assigneeSource === "route" ? !values.routeId.trim() : !values.employeeId.trim()) {
      return t("inventory.form.validation.dispatchedToRequired");
    }
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
      dispatchedAt: values.dispatchedAt.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
        <FormSection icon={PackageMinus} title={t("inventory.form.sections.dispatched")}>
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
              <Label htmlFor="quantity">{t("inventory.form.fields.quantityDispatched")}</Label>
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
              <Label htmlFor="availableStock">{t("inventory.form.fields.availableStock")}</Label>
              <Input
                id="availableStock"
                readOnly
                value={values.itemId ? String(available) : ""}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="incomeGained">{t("inventory.form.fields.incomeGained")}</Label>
              <Input
                id="incomeGained"
                type="number"
                min={0}
                step="0.01"
                value={values.incomeGained}
                onChange={(event) => setValues((current) => ({ ...current, incomeGained: event.target.value }))}
                onFocus={selectFormFieldTextOnFocus}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dispatchedAt">{t("inventory.form.fields.dispatchedAt")}</Label>
              <Input
                id="dispatchedAt"
                type="date"
                value={values.dispatchedAt}
                onChange={(event) => setValues((current) => ({ ...current, dispatchedAt: event.target.value }))}
                onFocus={selectFormFieldTextOnFocus}
                required
              />
            </div>
            <InventoryDispatchToSelect
              values={values}
              employees={employees}
              dailyRoutes={dailyRoutes}
              onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
            />
          </div>
        </FormSection>
      </FormBody>

      <FormFooter error={validationError} submitLabel={submitLabel} onCancel={onCancel} isSubmitting={isSubmitting} />
    </form>
  );
}
