"use client";

import { PackageMinus, PackagePlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmployeeForm } from "@/components/employees/employee-form";
import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { selectFormFieldTextOnFocus, useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { InventoryDispatchToSelect } from "@/components/inventory/inventory-dispatch-to-select";
import { InventoryItemForm } from "@/components/inventory/inventory-item-form";
import { ActiveRouteSection } from "@/components/pickup-delivery-routes/pickup-delivery-route-section";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import { normalizeApiError } from "@/lib/api/axios";
import {
  useCreateEmployee,
  useEmployees,
  useUpdateEmployee,
} from "@/lib/employees/hooks/use-employees";
import {
  createEmptyEmployeeForm,
  employeeToFormValues,
  type Employee,
  type EmployeeFormValues,
} from "@/lib/employees/types";
import { useTranslation } from "@/lib/i18n";
import { getInventoryItemLabel, toDateInputValue } from "@/lib/inventory/display";
import {
  useCreateInventoryItem,
  useUpdateInventoryItem,
} from "@/lib/inventory/hooks/use-inventory";
import {
  createEmptyInventoryForm,
  inventoryItemToFormValues,
  type InventoryFormValues,
  type InventoryItem,
} from "@/lib/inventory/types/catalog";
import { createEmptyDispatchForm, type DispatchFormValues } from "@/lib/inventory/types/documents";
import { DAILY_ROUTES_DIRECTORY_VARIANT } from "@/lib/pickup-delivery-routes/directory-variant";
import { useDailyRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";

type EntityDialog = "item" | "employee" | "route" | null;

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
  const [entityDialog, setEntityDialog] = useState<EntityDialog>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingRoute, setEditingRoute] = useState<ActiveRoute | null>(null);
  const [entityError, setEntityError] = useState<string | null>(null);
  const [pinnedItemLabel, setPinnedItemLabel] = useState("");
  const handleEnterNavigation = useFormEnterNavigation();
  const employeesQuery = useEmployees({ page: 1, limit: 200, sort: "name:asc" });
  const dailyRoutesQuery = useDailyRoutePicker(200);
  const createItem = useCreateInventoryItem();
  const updateItem = useUpdateInventoryItem();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const employees = useMemo(
    () => (employeesQuery.data?.items ?? []).filter((employee) => employee.active),
    [employeesQuery.data?.items],
  );
  const dailyRoutes = dailyRoutesQuery.data?.items ?? [];

  const selectedItem = items.find((item) => item.id === values.itemId) ?? editingItem;
  const selectedEmployee =
    employees.find((employee) => String(employee.id) === values.employeeId) ?? editingEmployee;
  const selectedRoute = dailyRoutes.find((route) => route.id === values.routeId) ?? editingRoute;

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

  useEffect(() => {
    setValues(createEmptyDispatchForm(toDateInputValue()));
    setValidationError(null);
    setPinnedItemLabel("");
  }, []);

  const available = values.itemId
    ? (items.find((item) => item.id === values.itemId)?.quantity ?? selectedItem?.quantity ?? 0)
    : 0;

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

  function openAddEmployee() {
    setEditingEmployee(null);
    setEntityError(null);
    setEntityDialog("employee");
  }

  function openEditEmployee() {
    if (!selectedEmployee) return;
    setEditingEmployee(selectedEmployee);
    setEntityError(null);
    setEntityDialog("employee");
  }

  function openAddRoute() {
    setEditingRoute(null);
    setEntityError(null);
    setEntityDialog("route");
  }

  function openEditRoute() {
    if (!selectedRoute) return;
    setEditingRoute(selectedRoute);
    setEntityError(null);
    setEntityDialog("route");
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

  async function saveEmployee(formValues: EmployeeFormValues) {
    try {
      setEntityError(null);
      const saved = editingEmployee
        ? await updateEmployee.mutateAsync({ employeeId: String(editingEmployee.id), values: formValues })
        : await createEmployee.mutateAsync(formValues);
      setValues((current) => ({
        ...current,
        assigneeSource: "employee",
        employeeId: String(saved.id),
        employeeName: saved.name,
        routeId: "",
        routeName: "",
        routeCrewId: "",
        routeCrewName: "",
      }));
      setEntityDialog(null);
      setEditingEmployee(null);
    } catch (error) {
      setEntityError(normalizeApiError(error).message);
    }
  }

  function selectRoute(route?: ActiveRoute) {
    if (!route) {
      setEntityDialog(null);
      setEditingRoute(null);
      return;
    }
    const crewName =
      route.route?.name.trim() ||
      route.employees.map((employee) => employee.name.trim()).filter(Boolean).join(", ") ||
      "";
    setValues((current) => ({
      ...current,
      assigneeSource: "route",
      routeId: route.id,
      routeName: route.name.trim() || crewName || route.id,
      routeCrewId: route.route?.id || "",
      routeCrewName: crewName,
      employeeId: "",
      employeeName: "",
    }));
    setEntityDialog(null);
    setEditingRoute(null);
  }

  return (
    <>
      <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
        <FormBody isBusy={isSubmitting}>
          <FormSection icon={PackageMinus} title={t("inventory.form.sections.dispatched")}>
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
                onAddEmployee={openAddEmployee}
                onEditEmployee={openEditEmployee}
                onAddRoute={openAddRoute}
                onEditRoute={openEditRoute}
              />
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

      <Dialog open={entityDialog === "employee"} onOpenChange={(open) => !open && setEntityDialog(null)}>
        <DialogContent className="z-[70] flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>
              {editingEmployee ? t("employees.form.editTitle") : t("employees.form.addTitle")}
            </DialogTitle>
          </DialogHeader>
          <EmployeeForm
            key={editingEmployee?.id ?? "new"}
            initialValues={editingEmployee ? employeeToFormValues(editingEmployee) : createEmptyEmployeeForm()}
            isEditing={Boolean(editingEmployee)}
            submitLabel={editingEmployee ? t("common.actions.saveChanges") : t("employees.actions.add")}
            isSubmitting={createEmployee.isPending || updateEmployee.isPending}
            externalError={entityError}
            onSubmit={saveEmployee}
            onCancel={() => setEntityDialog(null)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={entityDialog === "route"} onOpenChange={(open) => !open && setEntityDialog(null)}>
        <DialogContent className="z-[70] flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>
              {editingRoute ? t("routes.dailyRoutes.editTitle") : t("routes.dailyRoutes.addTabLabel")}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ActiveRouteSection
              key={editingRoute?.id ?? "new-route"}
              initialRecord={editingRoute}
              variant={DAILY_ROUTES_DIRECTORY_VARIANT}
              defaultDate={values.dispatchedAt.slice(0, 10) || undefined}
              onSaved={selectRoute}
              onCancel={() => setEntityDialog(null)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
