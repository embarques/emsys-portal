"use client";

import {
  Building2,
  CalendarRange,
  CircleCheck,
  ClipboardList,
  Container,
  DollarSign,
  Plus,
  Package,
  Route as RouteIcon,
  Tag,
  Users,
} from "lucide-react";

import { CrewRolePicker } from "@/components/route-manager/crew-role-picker";
import { RouteEmployeeSelect } from "@/components/route-manager/route-employee-select";
import { PickupRouteOrdersSection } from "@/components/pickup-delivery-routes/pickup-route-orders-section";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import type { RouteCrewRole, RouteEmployeeRef } from "@/lib/route-manager/types";
import type {
  ActiveRouteFormValues,
  RouteScheduleType,
  RouteType,
} from "@/lib/pickup-delivery-routes/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ActiveRouteFormProps = {
  values: ActiveRouteFormValues;
  isEditing?: boolean;
  isDelivery: boolean;
  copyPrefix?: "pickupRoutes" | "deliveryRoutes";
  showRouteTypeField?: boolean;
  showContainerField?: boolean;
  showBranchField?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  routeOptions: SearchableSelectOption[];
  containerOptions: SearchableSelectOption[];
  branchOptions: SearchableSelectOption[];
  dayOfWeekOptions: SearchableSelectOption[];
  branchCode: string;
  branchesLoading?: boolean;
  routesLoading?: boolean;
  selectedRouteLoading?: boolean;
  submitDisabled?: boolean;
  onRouteTypeChange: (routeType: RouteType) => void;
  onScheduleTypeChange: (scheduleType: RouteScheduleType) => void;
  onBranchChange: (branchCode: string) => void;
  onDateChange: (date: string) => void;
  onDayOfWeekChange: (dayOfWeek: string[]) => void;
  onNameChange: (name: string) => void;
  onContainerChange: (containerId: string) => void;
  onRateChange: (rate: string) => void;
  onRouteRecordChange: (routeRecordId: string) => void;
  onRoleChange: (employeeId: number, role: RouteCrewRole) => void;
  onEmployeesChange: (employees: RouteEmployeeRef[]) => void;
  onRemoveEmployee: (employeeId: number) => void;
  onActiveChange: (active: boolean) => void;
  onCreateRouteClick: () => void;
  onSubmit: () => void;
  onCancel?: () => void;
  vehicleRouteId?: string;
};

function routeTypeLabel(routeType: RouteType, t: (key: string) => string): string {
  return routeType === "delivery"
    ? t("routes.activeRoute.routeTypeDelivery")
    : t("routes.activeRoute.routeTypePickup");
}

export function ActiveRouteForm({
  values,
  isEditing = false,
  isDelivery,
  copyPrefix,
  showRouteTypeField = true,
  showContainerField,
  showBranchField = true,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  routeOptions,
  containerOptions,
  branchOptions,
  dayOfWeekOptions,
  branchCode,
  branchesLoading = false,
  routesLoading = false,
  selectedRouteLoading = false,
  submitDisabled = false,
  onRouteTypeChange,
  onScheduleTypeChange,
  onBranchChange,
  onDateChange,
  onDayOfWeekChange,
  onNameChange,
  onContainerChange,
  onRateChange,
  onRouteRecordChange,
  onRoleChange,
  onEmployeesChange,
  onRemoveEmployee,
  onActiveChange,
  onCreateRouteClick,
  onSubmit,
  onCancel,
  vehicleRouteId,
}: ActiveRouteFormProps) {
  const { t } = useTranslation();
  const handleEnterNavigation = useFormEnterNavigation();
  const containerVisible = showContainerField ?? isDelivery;
  // Delivery routes are always date-based; only pickups can recur by weekday.
  const allowDayOfWeek = values.routeType === "pickup";
  const isDayOfWeek = allowDayOfWeek && values.scheduleType === "dayOfWeek";
  // Day-of-week pickups can be named by the user; delivery names and one-time
  // (date) pickup names are server-generated.
  const showNameField = values.routeType === "pickup" && isDayOfWeek;
  const crewRoles: RouteCrewRole[] = ["driver", "appraiser", "helper"];

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
      <FormBody>
        <FormSection icon={CircleCheck} title={t("routes.activeRoute.status")}>
          <div
            className="inline-flex items-center gap-1 rounded-lg border border-input bg-muted p-1"
            role="radiogroup"
            aria-label={t("routes.activeRoute.status")}
          >
            {[
              { value: true, label: t("routes.activeRoute.active") },
              { value: false, label: t("routes.activeRoute.inactive") },
            ].map((option) => {
              const selected = values.active === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onActiveChange(option.value)}
                  className={cn(
                    "rounded-md px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    selected && option.value
                      ? "bg-emerald-600 text-white shadow-sm"
                      : selected
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </FormSection>

        {showRouteTypeField ? (
          <FormSection icon={ClipboardList} title={t("routes.activeRoute.routeType")} required>
            <div
              className="inline-flex rounded-lg border border-input bg-muted p-1"
              role="radiogroup"
              aria-label={t("routes.activeRoute.routeType")}
            >
              {(["pickup", "delivery"] as const).map((routeType) => {
                const selected = values.routeType === routeType;
                return (
                  <button
                    key={routeType}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => onRouteTypeChange(routeType)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      selected
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {routeTypeLabel(routeType, t)}
                  </button>
                );
              })}
            </div>
          </FormSection>
        ) : null}

        <FormSection icon={CalendarRange} title={t("routes.activeRoute.schedule")} required>
          <div className="space-y-2.5">
            {allowDayOfWeek ? (
              <div
                className="inline-flex rounded-lg border border-input bg-muted p-1"
                role="radiogroup"
                aria-label={t("routes.activeRoute.schedule")}
              >
                {(["date", "dayOfWeek"] as const).map((scheduleType) => {
                  const selected = values.scheduleType === scheduleType;
                  return (
                    <button
                      key={scheduleType}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onScheduleTypeChange(scheduleType)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        selected
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {scheduleType === "date"
                        ? t("routes.activeRoute.scheduleDate")
                        : t("routes.activeRoute.scheduleDayOfWeek")}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {isDayOfWeek ? (
              <div
                className="flex flex-wrap gap-1.5"
                role="group"
                aria-label={t("routes.activeRoute.dayOfWeek")}
              >
                {dayOfWeekOptions.map((option) => {
                  const selected = values.dayOfWeek.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        onDayOfWeekChange(
                          selected
                            ? values.dayOfWeek.filter((day) => day !== option.value)
                            : [...values.dayOfWeek, option.value],
                        )
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <DateInput
                id="active-route-date"
                aria-label={t("routes.activeRoute.date")}
                value={values.date}
                onChange={(event) => onDateChange(event.target.value)}
                required
              />
            )}
          </div>
        </FormSection>

        {showNameField ? (
          <FormSection icon={Tag} title={t("routes.activeRoute.name")}>
            <Input
              id="active-route-name"
              value={values.name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder={t("routes.activeRoute.namePlaceholder")}
            />
          </FormSection>
        ) : null}

        {containerVisible ? (
          <FormSection icon={Container} title={t("routes.activeRoute.container")} required>
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
        ) : null}

        {isDelivery ? (
          <FormSection icon={DollarSign} title={t("routes.activeRoute.rate")}>
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
        ) : null}

        {showBranchField ? (
          <FormSection icon={Building2} title={t("routes.activeRoute.branch")} required>
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
          </FormSection>
        ) : null}

        <FormSection
          icon={RouteIcon}
          title={t("routes.activeRoute.route")}
          required
          action={
            <Button type="button" variant="outline" size="sm" onClick={onCreateRouteClick}>
              <Plus className="size-4" />
              {t("routes.activeRoute.createRoute")}
            </Button>
          }
        >
          <SearchableSelect
            id="active-route-route"
            aria-label={t("routes.activeRoute.route")}
            value={values.routeRecordId}
            onValueChange={onRouteRecordChange}
            placeholder={t("routes.activeRoute.routePlaceholder")}
            searchPlaceholder={t("routes.activeRoute.routeSearch")}
            loading={routesLoading}
            loadingMessage={t("common.loading")}
            emptyMessage={t("routes.activeRoute.routeEmpty")}
            options={routeOptions}
            required
          />
        </FormSection>

        {values.routeRecordId ? (
          <FormSection icon={Users} title={t("routes.activeRoute.crewRoles")}>
            <div className="space-y-3">
              <RouteEmployeeSelect
                value={values.employees}
                onChange={onEmployeesChange}
                branchCode={branchCode}
                showSelectedList={false}
              />
              <CrewRolePicker
                employees={values.employees}
                onRoleChange={onRoleChange}
                onRemove={onRemoveEmployee}
                roles={crewRoles}
                toggleLeadRoles
                loading={selectedRouteLoading}
              />
            </div>
          </FormSection>
        ) : null}

        {isEditing && !isDelivery && vehicleRouteId ? (
          <FormSection icon={Package} title={t("routes.pickupRoutes.view.sections.orders")}>
            <PickupRouteOrdersSection routeId={vehicleRouteId} editable />
          </FormSection>
        ) : null}

        {isEditing ? (
          <p className="text-xs text-muted-foreground">
            {copyPrefix
              ? t(`routes.${copyPrefix}.form.editHint`)
              : t("routes.activeRouteForm.editHint")}
          </p>
        ) : null}
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
