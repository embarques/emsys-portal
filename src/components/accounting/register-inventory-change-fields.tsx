"use client";

import { Building2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";

import { TransactionAssigneeSelect } from "@/components/accounting/transaction-assignee-select";
import { EmployeeForm } from "@/components/employees/employee-form";
import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { InventorySupplierForm } from "@/components/inventory/inventory-supplier-form";
import { ActiveRouteSection } from "@/components/pickup-delivery-routes/pickup-delivery-route-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { selectFormFieldTextOnFocus } from "@/hooks/use-form-enter-navigation";
import {
  linkedInventoryTotal,
  linkedInventoryUnitPrice,
} from "@/lib/accounting/daily-income/inventory-change";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import { moneyFormSetValueAs } from "@/lib/accounting/daily-income/money-input";
import type {
  DailyIncomeJournalValues,
  InventoryChangeDirection,
} from "@/lib/accounting/daily-income/types";
import { normalizeApiError } from "@/lib/api/axios";
import {
  useCreateEmployee,
  useUpdateEmployee,
} from "@/lib/employees/hooks/use-employees";
import {
  createEmptyEmployeeForm,
  employeeToFormValues,
  type Employee,
  type EmployeeFormValues,
} from "@/lib/employees/types";
import { getInventoryItemLabel } from "@/lib/inventory/display";
import {
  useCreateSupplier,
  useInventoryItems,
  useInventorySuppliers,
  useUpdateSupplier,
} from "@/lib/inventory/hooks/use-inventory";
import {
  createEmptySupplierForm,
  supplierToFormValues,
  type InventorySupplier,
  type SupplierFormValues,
} from "@/lib/inventory/types/suppliers";
import { useTranslation } from "@/lib/i18n";
import { DAILY_ROUTES_DIRECTORY_VARIANT } from "@/lib/pickup-delivery-routes/directory-variant";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";

type EntityDialog = "supplier" | "employee" | "route" | null;

type Props = {
  employees: Employee[];
  dailyRoutes?: ActiveRoute[];
  statementDate?: string;
  errors: FieldErrors<DailyIncomeJournalValues>;
  setValue: UseFormSetValue<DailyIncomeJournalValues>;
  watch: UseFormWatch<DailyIncomeJournalValues>;
};

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor}>
      {children}
      <span className="text-destructive"> *</span>
    </Label>
  );
}

function numberInputValue(value: number | undefined): string {
  return value == null || Number.isNaN(value) ? "" : String(value);
}

export function RegisterInventoryChangeFields({
  employees,
  dailyRoutes = [],
  statementDate,
  errors,
  setValue,
  watch,
}: Props) {
  const { t } = useTranslation();
  const { data: items = [] } = useInventoryItems();
  const { data: suppliers = [] } = useInventorySuppliers();
  const createSupplier = useCreateSupplier();
  const updateSupplier = useUpdateSupplier();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();

  const direction = watch("inventoryDirection");
  const itemId = watch("inventoryItemId");
  const itemName = watch("inventoryItemName");
  const quantity = watch("inventoryQuantity");
  const unitPrice = watch("inventoryUnitPrice");
  const total = watch("inventoryTotal");
  const supplierId = watch("inventorySupplierId");
  const supplierName = watch("inventorySupplierName");
  const employeeId = watch("employeeId");
  const employeeName = watch("employeeName");
  const routeId = watch("routeId");
  const routeName = watch("routeName");
  const assigneeSource = watch("assigneeSource");

  const [priceSource, setPriceSource] = useState<"unit" | "total">("unit");
  const [entityDialog, setEntityDialog] = useState<EntityDialog>(null);
  const [editingSupplier, setEditingSupplier] = useState<InventorySupplier | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editingRoute, setEditingRoute] = useState<ActiveRoute | null>(null);
  const [entityError, setEntityError] = useState<string | null>(null);

  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId) ?? editingSupplier;
  const selectedEmployee = employees.find((employee) => employee.id === employeeId) ?? editingEmployee;
  const selectedRoute = dailyRoutes.find((route) => route.id === routeId) ?? editingRoute;

  const directionOptions = [
    { value: "received", label: t("accounting.dailyIncome.form.inventory.received") },
    { value: "dispatched", label: t("accounting.dailyIncome.form.inventory.dispatched") },
  ];
  const itemOptions = useMemo(
    () =>
      withPinnedSelectOption(
        items.map((item) => ({
          value: item.id,
          label: getInventoryItemLabel(item),
          keywords: [item.item],
        })),
        itemId,
        itemName,
      ),
    [itemId, itemName, items],
  );
  const supplierOptions = useMemo(
    () =>
      withPinnedSelectOption(
        suppliers.map((supplier) => ({
          value: supplier.id,
          label: supplier.companyName,
          keywords: [...supplier.contactNames, ...supplier.emails],
        })),
        supplierId,
        supplierName,
      ),
    [supplierId, supplierName, suppliers],
  );

  function applyLinkedPrices(nextQuantity: number | undefined, nextUnit: number | undefined, nextTotal: number | undefined, source: "quantity" | "unit" | "total") {
    const qty = nextQuantity ?? 0;
    if (source === "unit") {
      setPriceSource("unit");
      setValue("inventoryUnitPrice", nextUnit, { shouldValidate: true });
      setValue("inventoryTotal", qty > 0 && nextUnit != null ? linkedInventoryTotal(qty, nextUnit) : nextTotal, {
        shouldValidate: true,
      });
      return;
    }
    if (source === "total") {
      setPriceSource("total");
      setValue("inventoryTotal", nextTotal, { shouldValidate: true });
      setValue(
        "inventoryUnitPrice",
        qty > 0 && nextTotal != null ? linkedInventoryUnitPrice(qty, nextTotal) : nextUnit,
        { shouldValidate: true },
      );
      return;
    }
    setValue("inventoryQuantity", nextQuantity, { shouldValidate: true });
    if (priceSource === "total" && nextTotal != null && qty > 0) {
      setValue("inventoryUnitPrice", linkedInventoryUnitPrice(qty, nextTotal), { shouldValidate: true });
      return;
    }
    if (nextUnit != null && qty > 0) {
      setValue("inventoryTotal", linkedInventoryTotal(qty, nextUnit), { shouldValidate: true });
    }
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

  async function saveSupplier(values: SupplierFormValues) {
    try {
      setEntityError(null);
      const saved = editingSupplier
        ? await updateSupplier.mutateAsync({ id: editingSupplier.id, values })
        : await createSupplier.mutateAsync(values);
      setValue("inventorySupplierId", saved.id, { shouldValidate: true });
      setValue("inventorySupplierName", saved.companyName);
      setEntityDialog(null);
      setEditingSupplier(null);
    } catch (error) {
      setEntityError(normalizeApiError(error).message);
    }
  }

  async function saveEmployee(values: EmployeeFormValues) {
    try {
      setEntityError(null);
      const saved = editingEmployee
        ? await updateEmployee.mutateAsync({ employeeId: String(editingEmployee.id), values })
        : await createEmployee.mutateAsync(values);
      setValue("assigneeSource", "employee", { shouldValidate: true });
      setValue("employeeId", saved.id, { shouldValidate: true });
      setValue("employeeName", saved.name);
      setValue("routeId", undefined, { shouldValidate: true });
      setValue("routeName", "");
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
    setValue("assigneeSource", "route", { shouldValidate: true });
    setValue("routeId", route.id, { shouldValidate: true });
    setValue("routeName", route.name.trim() || crewName || route.id);
    setValue("routeCrewId", route.route?.id || undefined, { shouldValidate: true });
    setValue("routeCrewName", crewName);
    setValue("employeeId", undefined, { shouldValidate: true });
    setValue("employeeName", "");
    setEntityDialog(null);
    setEditingRoute(null);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <RequiredLabel htmlFor="journal-inventory-direction">
          {t("accounting.dailyIncome.form.fields.inventoryDirection")}
        </RequiredLabel>
        <SearchableSelect
          id="journal-inventory-direction"
          value={direction ?? ""}
          onValueChange={(next) => {
            const value = next === "dispatched" || next === "received" ? (next as InventoryChangeDirection) : undefined;
            setValue("inventoryDirection", value, { shouldValidate: true });
            if (value === "received") {
              setValue("employeeId", undefined, { shouldValidate: true });
              setValue("employeeName", "");
              setValue("routeId", undefined, { shouldValidate: true });
              setValue("routeName", "");
            } else {
              setValue("inventorySupplierId", undefined, { shouldValidate: true });
              setValue("inventorySupplierName", "");
            }
          }}
          placeholder={t("accounting.dailyIncome.form.placeholders.selectInventoryDirection")}
          searchable={false}
          options={directionOptions}
        />
        {errors.inventoryDirection ? (
          <p className="text-sm text-destructive">{errors.inventoryDirection.message}</p>
        ) : null}
      </div>

      {direction === "received" ? (
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <RequiredLabel htmlFor="journal-inventory-supplier">
              {t("inventory.form.fields.supplier")}
            </RequiredLabel>
            <FieldEntityActions
              hasSelection={Boolean(supplierId)}
              onAdd={openAddSupplier}
              onEdit={openEditSupplier}
              addIcon={Building2}
            />
          </div>
          <SearchableSelect
            id="journal-inventory-supplier"
            value={supplierId ?? ""}
            onValueChange={(next) => {
              const supplier = suppliers.find((entry) => entry.id === next);
              setValue("inventorySupplierId", supplier?.id ?? "", { shouldValidate: true });
              setValue("inventorySupplierName", supplier?.companyName ?? "");
            }}
            placeholder={t("inventory.form.placeholders.supplier")}
            searchPlaceholder={t("inventory.search.suppliers")}
            mobileSheet
            options={supplierOptions}
          />
          {errors.inventorySupplierId ? (
            <p className="text-sm text-destructive">{errors.inventorySupplierId.message}</p>
          ) : null}
        </div>
      ) : null}

      {direction === "dispatched" ? (
        <div className="sm:col-span-2">
          <TransactionAssigneeSelect
            employees={employees}
            dailyRoutes={dailyRoutes}
            statementDate={statementDate}
            employeeId={employeeId}
            employeeName={employeeName}
            routeId={routeId}
            routeName={routeName}
            assigneeSource={assigneeSource}
            error={errors.employeeId?.message ?? errors.routeId?.message}
            setValue={setValue}
            onAddEmployee={openAddEmployee}
            onEditEmployee={openEditEmployee}
            onAddRoute={openAddRoute}
            onEditRoute={openEditRoute}
          />
        </div>
      ) : null}

      <div className="space-y-2 sm:col-span-2">
        <RequiredLabel htmlFor="journal-inventory-item">{t("inventory.form.fields.item")}</RequiredLabel>
        <SearchableSelect
          id="journal-inventory-item"
          value={itemId ?? ""}
          onValueChange={(next) => {
            const item = items.find((entry) => entry.id === next);
            setValue("inventoryItemId", item?.id ?? "", { shouldValidate: true });
            setValue("inventoryItemName", item ? getInventoryItemLabel(item) : "");
          }}
          placeholder={t("inventory.form.placeholders.item")}
          searchPlaceholder={t("inventory.search.items")}
          mobileSheet
          options={itemOptions}
        />
        {errors.inventoryItemId ? <p className="text-sm text-destructive">{errors.inventoryItemId.message}</p> : null}
      </div>

      <div className="space-y-2">
        <RequiredLabel htmlFor="journal-inventory-quantity">{t("inventory.form.fields.quantity")}</RequiredLabel>
        <Input
          id="journal-inventory-quantity"
          type="number"
          min={0}
          step="1"
          value={numberInputValue(quantity)}
          onChange={(event) => {
            const next = moneyFormSetValueAs(event.target.value);
            applyLinkedPrices(next, unitPrice, total, "quantity");
          }}
          onFocus={selectFormFieldTextOnFocus}
        />
        {errors.inventoryQuantity ? (
          <p className="text-sm text-destructive">{errors.inventoryQuantity.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <RequiredLabel htmlFor="journal-inventory-unit-price">
          {t("accounting.dailyIncome.form.fields.unitPrice")}
        </RequiredLabel>
        <Input
          id="journal-inventory-unit-price"
          type="number"
          min={0}
          step="0.01"
          value={numberInputValue(unitPrice)}
          onChange={(event) => {
            const next = moneyFormSetValueAs(event.target.value);
            applyLinkedPrices(quantity, next, total, "unit");
          }}
          onFocus={selectFormFieldTextOnFocus}
        />
      </div>

      <div className="space-y-2 sm:col-span-2">
        <RequiredLabel htmlFor="journal-inventory-total">{t("accounting.dailyIncome.form.fields.total")}</RequiredLabel>
        <Input
          id="journal-inventory-total"
          type="number"
          min={0}
          step="0.01"
          value={numberInputValue(total)}
          onChange={(event) => {
            const next = moneyFormSetValueAs(event.target.value);
            applyLinkedPrices(quantity, unitPrice, next, "total");
          }}
          onFocus={selectFormFieldTextOnFocus}
        />
        {errors.inventoryTotal ? <p className="text-sm text-destructive">{errors.inventoryTotal.message}</p> : null}
        <p className="text-xs text-muted-foreground">{t("accounting.dailyIncome.form.inventory.priceHint")}</p>
      </div>

      <Dialog open={entityDialog === "supplier"} onOpenChange={(open) => !open && setEntityDialog(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
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

      <Dialog open={entityDialog === "employee"} onOpenChange={(open) => !open && setEntityDialog(null)}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
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
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
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
              defaultDate={statementDate}
              onSaved={selectRoute}
              onCancel={() => setEntityDialog(null)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
