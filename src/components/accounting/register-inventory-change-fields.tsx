"use client";

import { Building2, Route, UserPlus, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { FieldErrors, UseFormSetValue, UseFormWatch } from "react-hook-form";

import { FormSection } from "@/components/forms/form-shell";
import { EmployeeForm } from "@/components/employees/employee-form";
import { FieldEntityActions } from "@/components/forms/field-entity-actions";
import { InventorySupplierForm } from "@/components/inventory/inventory-supplier-form";
import { ActiveRouteSection } from "@/components/pickup-delivery-routes/pickup-delivery-route-section";
import { RouteEmployeeSelect } from "@/components/route-manager/route-employee-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { selectFormFieldTextOnFocus } from "@/hooks/use-form-enter-navigation";
import {
  dailyRoutesForAssigneeBranch,
  dailyRoutesForStatement,
} from "@/lib/accounting/daily-income/assignee";
import {
  dailyRouteInventoryHolders,
  linkedInventoryTotal,
  linkedInventoryUnitPrice,
} from "@/lib/accounting/daily-income/inventory-change";
import { withPinnedSelectOption } from "@/lib/accounting/daily-income/journal-form";
import { moneyFormSetValueAs } from "@/lib/accounting/daily-income/money-input";
import type {
  DailyIncomeJournalValues,
  InventoryChangeDirection,
  InventoryHolderEmployeeRef,
} from "@/lib/accounting/daily-income/types";
import { normalizeApiError } from "@/lib/api/axios";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useCreateEmployee } from "@/lib/employees/hooks/use-employees";
import { createEmptyEmployeeForm, type EmployeeFormValues } from "@/lib/employees/types";
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
import { buildActiveRouteAssignmentOptions } from "@/lib/pickup-delivery-routes/display";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";
import { useVehiclePicker } from "@/lib/vehicles/hooks/use-vehicles";

type EntityDialog = "supplier" | "employee" | "route" | null;

type Props = {
  activeStep?: "assignment" | "amounts" | "payment" | "review";
  dailyRoutes?: ActiveRoute[];
  statementDate?: string;
  statementBranchId?: number | null;
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

const NO_SELECTION = "none";

export function RegisterInventoryChangeFields({
  activeStep,
  dailyRoutes = [],
  statementDate,
  statementBranchId,
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

  const direction = watch("inventoryDirection");
  const itemId = watch("inventoryItemId");
  const itemName = watch("inventoryItemName");
  const quantity = watch("inventoryQuantity");
  const unitPrice = watch("inventoryUnitPrice");
  const total = watch("inventoryTotal");
  const supplierId = watch("inventorySupplierId");
  const supplierName = watch("inventorySupplierName");
  const routeId = watch("routeId");
  const routeName = watch("routeName");
  const holderVehicleId = watch("inventoryHolderVehicleId");
  const holderVehicleName = watch("inventoryHolderVehicleName");
  const holderEmployeesValue = watch("inventoryHolderEmployees");
  const holderEmployees = useMemo(() => holderEmployeesValue ?? [], [holderEmployeesValue]);

  const [priceSource, setPriceSource] = useState<"unit" | "total">("unit");
  const [entityDialog, setEntityDialog] = useState<EntityDialog>(null);
  const [editingSupplier, setEditingSupplier] = useState<InventorySupplier | null>(null);
  const [editingRoute, setEditingRoute] = useState<ActiveRoute | null>(null);
  const [entityError, setEntityError] = useState<string | null>(null);

  const selectedSupplier = suppliers.find((supplier) => supplier.id === supplierId) ?? editingSupplier;
  const selectedRoute = dailyRoutes.find((route) => route.id === routeId) ?? editingRoute;

  const dispatched = direction === "dispatched";
  const branchesQuery = useBranchPicker(200, { enabled: dispatched });
  const branchCode =
    selectedRoute?.branch?.code?.trim() ||
    branchesQuery.data?.items.find((branch) => branch.id === statementBranchId)?.code.trim() ||
    "";
  const vehiclesQuery = useVehiclePicker(200, { enabled: dispatched, branchCode: branchCode || undefined });
  const vehicles = useMemo(() => vehiclesQuery.data?.items ?? [], [vehiclesQuery.data?.items]);

  const vehicleOptions = useMemo(
    () => [
      { value: NO_SELECTION, label: t("accounting.dailyIncome.form.placeholders.noVehicle") },
      ...withPinnedSelectOption(
        vehicles
          .filter((vehicle) => vehicle.active)
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((vehicle) => ({
            value: vehicle.id,
            label: vehicle.name || vehicle.vehicleId || vehicle.id,
            keywords: [vehicle.name, vehicle.vehicleId, vehicle.licensePlate].filter(Boolean),
          })),
        holderVehicleId,
        holderVehicleName,
      ),
    ],
    [holderVehicleId, holderVehicleName, t, vehicles],
  );

  const routeOptions = useMemo(() => {
    const scoped = dailyRoutesForAssigneeBranch(dailyRoutesForStatement(dailyRoutes, statementDate), statementBranchId);
    const list = selectedRoute && !scoped.some((route) => route.id === selectedRoute.id) ? [selectedRoute, ...scoped] : scoped;
    return [
      { value: NO_SELECTION, label: t("accounting.dailyIncome.form.placeholders.noDailyRoute") },
      ...withPinnedSelectOption(
        buildActiveRouteAssignmentOptions(list, t).map((option) => ({
          value: option.value,
          label: option.label,
          keywords: (option as { keywords?: string[] }).keywords,
        })),
        routeId,
        routeName,
      ),
    ];
  }, [dailyRoutes, routeId, routeName, selectedRoute, statementBranchId, statementDate, t]);

  function setRoute(route: ActiveRoute | undefined, fallbackId?: string) {
    const id = route?.id ?? fallbackId;
    const employeeNames = route?.employees.map((employee) => employee.name.trim()).filter(Boolean).join(", ") || "";
    setValue("routeId", id, { shouldValidate: true });
    setValue("routeName", route ? route.name.trim() || employeeNames || route.id : id ?? "");
    setValue("routeCrewId", undefined);
    setValue("routeCrewName", "");
  }

  function handleRouteChange(next: string) {
    if (!next || next === NO_SELECTION) {
      setRoute(undefined);
      return;
    }
    setRoute(dailyRoutes.find((route) => route.id === next), next);
  }

  function setHolderEmployees(next: InventoryHolderEmployeeRef[]) {
    setValue(
      "inventoryHolderEmployees",
      next.map((employee) => ({ id: employee.id, name: employee.name })),
      { shouldValidate: true },
    );
  }

  function setHolderVehicle(vehicle: { id: string; name: string } | null) {
    setValue("inventoryHolderVehicleId", vehicle?.id, { shouldValidate: true });
    setValue("inventoryHolderVehicleName", vehicle?.name ?? "");
    // The holders error lives on the employee list; revalidate it when the vehicle changes.
    setHolderEmployees(holderEmployees);
  }

  function handleVehicleChange(next: string) {
    if (!next || next === NO_SELECTION) {
      setHolderVehicle(null);
      return;
    }
    const option = vehicleOptions.find((item) => item.value === next);
    setHolderVehicle({ id: next, name: option?.label ?? next });
  }

  function applyRouteHolders() {
    if (!selectedRoute) return;
    const holders = dailyRouteInventoryHolders(selectedRoute);
    setValue("inventoryHolderVehicleId", holders.vehicle?.id, { shouldValidate: true });
    setValue("inventoryHolderVehicleName", holders.vehicle?.name ?? "");
    setHolderEmployees(holders.employees);
  }

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
          keywords: [item.sku, item.category],
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
          keywords: supplier.contacts.flatMap((contact) => [contact.name, contact.email]),
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
        ? await updateSupplier.mutateAsync({ supplier: editingSupplier, values })
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
      const saved = await createEmployee.mutateAsync(values);
      setHolderEmployees([
        ...holderEmployees.filter((employee) => employee.id !== saved.id),
        { id: saved.id, name: saved.name },
      ]);
      setEntityDialog(null);
    } catch (error) {
      setEntityError(normalizeApiError(error).message);
    }
  }

  function selectRoute(route?: ActiveRoute) {
    if (route) setRoute(route);
    setEntityDialog(null);
    setEditingRoute(null);
  }

  return (
    <div className="space-y-5">
      <FormSection className={activeStep && activeStep !== "assignment" ? "hidden" : undefined} variant="card" title={t("accounting.dailyIncome.form.sections.inventoryMovement")}>
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
                  setValue("inventoryHolderVehicleId", undefined);
                  setValue("inventoryHolderVehicleName", "");
                  setValue("inventoryHolderEmployees", [], { shouldValidate: true });
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

          {dispatched ? (
            <>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="journal-route">{t("accounting.dailyIncome.form.fields.inventoryDailyRoute")}</Label>
                  <FieldEntityActions
                    hasSelection={Boolean(routeId)}
                    onAdd={openAddRoute}
                    onEdit={openEditRoute}
                    addIcon={Route}
                  />
                </div>
                <SearchableSelect
                  id="journal-route"
                  value={routeId || NO_SELECTION}
                  onValueChange={handleRouteChange}
                  placeholder={t("accounting.dailyIncome.form.placeholders.selectRoute")}
                  searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchRoutes")}
                  mobileSheet
                  options={routeOptions}
                />
                <p className="text-xs text-muted-foreground">
                  {t("accounting.dailyIncome.form.hints.inventoryDailyRoute")}
                </p>
              </div>

              <div className="space-y-3 sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <RequiredLabel htmlFor="journal-inventory-holder-vehicle">
                    {t("accounting.dailyIncome.form.fields.inventoryHolders")}
                  </RequiredLabel>
                  {selectedRoute ? (
                    <Button type="button" variant="outline" size="sm" onClick={applyRouteHolders}>
                      <Users className="size-4" aria-hidden="true" />
                      {t("accounting.dailyIncome.form.inventory.useRouteHolders")}
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="journal-inventory-holder-vehicle">
                      {t("accounting.dailyIncome.form.fields.holderVehicle")}
                    </Label>
                    <SearchableSelect
                      id="journal-inventory-holder-vehicle"
                      value={holderVehicleId || NO_SELECTION}
                      onValueChange={handleVehicleChange}
                      placeholder={t("accounting.dailyIncome.form.placeholders.selectHolderVehicle")}
                      searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchVehicles")}
                      emptyMessage={t("accounting.dailyIncome.form.placeholders.noVehiclesFound")}
                      loading={vehiclesQuery.isLoading}
                      mobileSheet
                      options={vehicleOptions}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="journal-inventory-holder-employee">
                        {t("accounting.dailyIncome.form.fields.holderEmployees")}
                      </Label>
                      <FieldEntityActions onAdd={openAddEmployee} addIcon={UserPlus} />
                    </div>
                    <RouteEmployeeSelect
                      id="journal-inventory-holder-employee"
                      value={holderEmployees}
                      onChange={setHolderEmployees}
                      branchCode={branchCode || undefined}
                      showSelectedList={false}
                      placeholder={t("accounting.dailyIncome.form.placeholders.addHolderEmployee")}
                      searchPlaceholder={t("accounting.dailyIncome.form.placeholders.searchEmployees")}
                      emptyMessage={t("accounting.dailyIncome.form.placeholders.noEmployeesFound")}
                    />
                  </div>
                </div>
                {holderEmployees.length > 0 ? (
                  <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-background">
                    {holderEmployees.map((employee) => (
                      <li key={employee.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                        <span className="min-w-0 font-medium">{employee.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setHolderEmployees(holderEmployees.filter((item) => item.id !== employee.id))}
                          aria-label={t("accounting.dailyIncome.form.inventory.removeHolderEmployee", { name: employee.name })}
                        >
                          <X className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("accounting.dailyIncome.form.hints.noHolderEmployees")}</p>
                )}
                {errors.inventoryHolderEmployees ? (
                  <p className="text-sm text-destructive">{errors.inventoryHolderEmployees.message}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">{t("accounting.dailyIncome.form.hints.inventoryHolders")}</p>
              </div>
            </>
          ) : null}

        </div>
      </FormSection>
      <FormSection className={activeStep && activeStep !== "amounts" ? "hidden" : undefined} variant="card" title={t("accounting.dailyIncome.form.sections.inventoryAmounts")}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-3">
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

          <div className="space-y-2">
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

        </div>
      </FormSection>

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
            <DialogTitle>{t("employees.form.addTitle")}</DialogTitle>
          </DialogHeader>
          <EmployeeForm
            key="new"
            initialValues={createEmptyEmployeeForm()}
            isEditing={false}
            submitLabel={t("employees.actions.add")}
            isSubmitting={createEmployee.isPending}
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
