"use client";

import {
  Building2,
  CalendarRange,
  Car,
  Container,
  DollarSign,
  History,
  Plus,
  Package,
  RotateCcw,
  Route as RouteIcon,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { CrewRolePicker } from "@/components/route-manager/crew-role-picker";
import { RouteEmployeeSelect } from "@/components/route-manager/route-employee-select";
import { FieldEntityActions, fieldEntityActionClassName } from "@/components/forms/field-entity-actions";
import { PickupRouteOrdersSection } from "@/components/pickup-delivery-routes/pickup-route-orders-section";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import type { RouteCrewRole, RouteEmployeeRef } from "@/lib/route-manager/types";
import type { ActiveRouteFormValues } from "@/lib/pickup-delivery-routes/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type RouteFormFieldProps = {
  htmlFor: string;
  icon: LucideIcon;
  label: string;
  required?: boolean;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

function RouteFormField({ htmlFor, icon: Icon, label, required = false, hint, action, children }: RouteFormFieldProps) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor} className="gap-1.5">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </Label>
        {action}
      </div>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

type ActiveRouteFormProps = {
  values: ActiveRouteFormValues;
  isEditing?: boolean;
  isDeliveryBranch: boolean;
  copyPrefix?: "pickupRoutes" | "deliveryRoutes" | "dailyRoutes";
  showPreviousRouteField?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  routeOptions: SearchableSelectOption[];
  containerOptions: SearchableSelectOption[];
  branchOptions: SearchableSelectOption[];
  vehicleOptions: SearchableSelectOption[];
  previousRouteOptions?: SearchableSelectOption[];
  previousRouteId?: string;
  branchCode: string;
  branchesLoading?: boolean;
  vehiclesLoading?: boolean;
  routesLoading?: boolean;
  previousRoutesLoading?: boolean;
  selectedRouteLoading?: boolean;
  submitDisabled?: boolean;
  onPreviousRouteChange?: (routeId: string) => void;
  onResetFields?: () => void;
  onBranchChange: (branchCode: string) => void;
  onDateChange: (date: string) => void;
  onVehicleChange: (vehicleId: string) => void;
  onContainerChange: (containerId: string) => void;
  onRateChange: (rate: string) => void;
  onRouteRecordChange: (routeRecordId: string) => void;
  onRoleChange: (employeeId: number, role: RouteCrewRole) => void;
  onEmployeesChange: (employees: RouteEmployeeRef[]) => void;
  onRemoveEmployee: (employeeId: number) => void;
  onCreateVehicleClick: () => void;
  onEditVehicleClick?: () => void;
  onCreateRouteClick: () => void;
  onEditRouteClick?: () => void;
  onSubmit: () => void;
  onCancel?: () => void;
  vehicleRouteId?: string;
};

export function ActiveRouteForm({
  values,
  isEditing = false,
  isDeliveryBranch,
  copyPrefix = "dailyRoutes",
  showPreviousRouteField = false,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  routeOptions,
  containerOptions,
  branchOptions,
  vehicleOptions,
  previousRouteOptions = [],
  previousRouteId = "",
  branchCode,
  branchesLoading = false,
  vehiclesLoading = false,
  routesLoading = false,
  previousRoutesLoading = false,
  selectedRouteLoading = false,
  submitDisabled = false,
  onPreviousRouteChange,
  onResetFields,
  onBranchChange,
  onDateChange,
  onVehicleChange,
  onContainerChange,
  onRateChange,
  onRouteRecordChange,
  onRoleChange,
  onEmployeesChange,
  onRemoveEmployee,
  onCreateVehicleClick,
  onEditVehicleClick,
  onCreateRouteClick,
  onEditRouteClick,
  onSubmit,
  onCancel,
  vehicleRouteId,
}: ActiveRouteFormProps) {
  const { t } = useTranslation();
  const handleEnterNavigation = useFormEnterNavigation();
  const hasBranch = Boolean(branchCode.trim());
  const crewRoles: RouteCrewRole[] = ["driver", "supervisor", "helper"];
  const resetFieldsButton = onResetFields ? (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={fieldEntityActionClassName}
      onClick={onResetFields}
      disabled={isSubmitting}
    >
      <RotateCcw className="size-3.5" />
      {t("routes.dailyRoutes.form.resetFields")}
    </Button>
  ) : null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleEnterNavigation}
      className="flex min-h-0 flex-1 flex-col"
    >
      <FormBody workflow isBusy={isSubmitting}>
        <div className="grid items-start gap-5 @4xl:grid-cols-2">
          <FormSection
            variant="card"
            className="@4xl:col-span-2"
            description={t("routes.dailyRoutes.form.design.loadFrom")}
            icon={History}
            title={t("routes.dailyRoutes.form.loadFrom")}
            action={resetFieldsButton}
          >
            <div className={cn("grid items-start gap-4", showPreviousRouteField && "@2xl:grid-cols-2")}>
              {showPreviousRouteField ? (
                <RouteFormField
                  htmlFor="daily-route-previous"
                  icon={History}
                  label={t("routes.dailyRoutes.form.previousRoute")}
                >
                  <SearchableSelect
                    id="daily-route-previous"
                    aria-label={t("routes.dailyRoutes.form.loadPrevious")}
                    value={previousRouteId}
                    onValueChange={(value) => onPreviousRouteChange?.(value)}
                    placeholder={t("routes.dailyRoutes.form.loadPreviousPlaceholder")}
                    searchPlaceholder={t("routes.dailyRoutes.form.loadPreviousSearch")}
                    loading={previousRoutesLoading}
                    loadingMessage={t("common.loading")}
                    emptyMessage={t("routes.dailyRoutes.form.loadPreviousEmpty")}
                    options={previousRouteOptions}
                  />
                </RouteFormField>
              ) : null}

              <RouteFormField
                htmlFor="active-route-route"
                icon={RouteIcon}
                label={t("routes.activeRoute.route")}
                hint={t("routes.dailyRoutes.form.design.crew")}
                action={
                  <FieldEntityActions
                    onAdd={onCreateRouteClick}
                    onEdit={onEditRouteClick}
                    hasSelection={Boolean(values.routeRecordId)}
                    addIcon={Plus}
                    newLabel={t("routes.activeRoute.createRoute")}
                  />
                }
              >
                <SearchableSelect
                  id="active-route-route"
                  aria-label={t("routes.activeRoute.route")}
                  value={values.routeRecordId}
                  onValueChange={onRouteRecordChange}
                  placeholder={
                    hasBranch
                      ? t("routes.activeRoute.routePlaceholder")
                      : t("routes.activeRoute.selectBranchFirst")
                  }
                  searchPlaceholder={t("routes.activeRoute.routeSearch")}
                  loading={routesLoading}
                  loadingMessage={t("common.loading")}
                  emptyMessage={
                    hasBranch
                      ? t("routes.activeRoute.routeEmpty")
                      : t("routes.activeRoute.selectBranchFirst")
                  }
                  options={routeOptions}
                />
              </RouteFormField>
            </div>
          </FormSection>

          <FormSection
            variant="card"
            className="@4xl:col-span-2"
            description={t("routes.dailyRoutes.form.design.assignment")}
            icon={Building2}
            title={t("routes.dailyRoutes.form.assignment")}
          >
            <div className="grid items-start gap-4 @3xl:grid-cols-3">
              <RouteFormField htmlFor="active-route-branch" icon={Building2} label={t("routes.activeRoute.branch")} required>
                <SearchableSelect
                  id="active-route-branch"
                  aria-label={t("routes.activeRoute.branch")}
                  value={branchCode}
                  onValueChange={onBranchChange}
                  placeholder={t("routes.activeRoute.branchPlaceholder")}
                  searchPlaceholder={t("routes.activeRoute.branchSearch")}
                  loading={branchesLoading}
                  loadingMessage={t("common.loading")}
                  options={branchOptions}
                />
              </RouteFormField>

              <RouteFormField htmlFor="active-route-date" icon={CalendarRange} label={t("routes.activeRoute.date")} required>
                <DateInput
                  id="active-route-date"
                  aria-label={t("routes.activeRoute.date")}
                  value={values.date}
                  onChange={(event) => onDateChange(event.target.value)}
                  required
                />
              </RouteFormField>

              <RouteFormField
                htmlFor="active-route-vehicle"
                icon={Car}
                label={t("routes.activeRoute.vehicle")}
                required
                action={
                  <FieldEntityActions
                    onAdd={onCreateVehicleClick}
                    onEdit={onEditVehicleClick}
                    hasSelection={Boolean(values.vehicle.id)}
                    addIcon={Plus}
                    newLabel={t("routes.activeRoute.createVehicle")}
                  />
                }
              >
                <SearchableSelect
                  id="active-route-vehicle"
                  aria-label={t("routes.activeRoute.vehicle")}
                  value={values.vehicle.id}
                  onValueChange={onVehicleChange}
                  placeholder={
                    hasBranch
                      ? t("routes.activeRoute.vehiclePlaceholder")
                      : t("routes.activeRoute.selectBranchFirstVehicle")
                  }
                  searchPlaceholder={t("routes.activeRoute.vehicleSearch")}
                  loading={vehiclesLoading}
                  loadingMessage={t("common.loading")}
                  emptyMessage={
                    hasBranch
                      ? t("routes.activeRoute.vehicleEmpty")
                      : t("routes.activeRoute.selectBranchFirstVehicle")
                  }
                  options={vehicleOptions}
                  required
                />
              </RouteFormField>
            </div>
          </FormSection>

          <FormSection variant="card" className="@4xl:col-span-2" description={t("routes.dailyRoutes.form.design.roles")} icon={Users} title={t("routes.activeRoute.crewRoles")} required>
            <div className="space-y-3">
              {hasBranch ? (
                <RouteEmployeeSelect
                  value={values.employees}
                  onChange={onEmployeesChange}
                  branchCode={branchCode}
                  showSelectedList={false}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{t("routes.activeRoute.selectBranchFirstEmployees")}</p>
              )}
              <CrewRolePicker
                employees={values.employees}
                onRoleChange={onRoleChange}
                onRemove={onRemoveEmployee}
                roles={crewRoles}
                toggleLeadRoles
                loading={selectedRouteLoading}
                emptyMessage={t("routes.activeRoute.employeesEmpty")}
              />
            </div>
          </FormSection>

          {isDeliveryBranch ? (
            <div className="grid items-stretch gap-5 @4xl:col-span-2 @4xl:grid-cols-2">
              <FormSection variant="card" className="h-full" icon={Container} title={t("routes.activeRoute.container")} required>
                <SearchableSelect
                  id="active-route-container"
                  aria-label={t("routes.activeRoute.container")}
                  value={values.container ? String(values.container.id) : ""}
                  onValueChange={onContainerChange}
                  placeholder={t("routes.activeRoute.containerPlaceholder")}
                  searchPlaceholder={t("routes.activeRoute.containerSearch")}
                  options={containerOptions}
                  required
                />
              </FormSection>

              <FormSection variant="card" className="h-full" icon={DollarSign} title={t("routes.activeRoute.rate")}>
                <div className="space-y-1.5">
                  <Input
                    id="active-route-rate"
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={values.rate}
                    onChange={(event) => onRateChange(event.target.value)}
                    placeholder={t("routes.activeRoute.ratePlaceholder")}
                    aria-describedby="active-route-rate-hint"
                  />
                  <p id="active-route-rate-hint" className="text-xs text-muted-foreground">
                    {t("routes.activeRoute.rateHint")}
                  </p>
                </div>
              </FormSection>
            </div>
          ) : null}

          {isEditing && !isDeliveryBranch && vehicleRouteId ? (
            <FormSection variant="card" className="@4xl:col-span-2" icon={Package} title={t("routes.pickupRoutes.view.sections.orders")}>
              <PickupRouteOrdersSection routeId={vehicleRouteId} editable />
            </FormSection>
          ) : null}

          {isEditing ? (
            <p className="text-xs text-muted-foreground @4xl:col-span-2">
              {t(`routes.${copyPrefix}.form.editHint`)}
            </p>
          ) : null}
        </div>
      </FormBody>

      <FormFooter
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        error={externalError}
        submitDisabled={submitDisabled}
        onCancel={onCancel}
      />
    </form>
  );
}
