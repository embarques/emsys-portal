"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarRange,
  Car,
  Container,
  DollarSign,
  History,
  Loader2,
  Plus,
  Package,
  RotateCcw,
  Route as RouteIcon,
  Save,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { CrewRolePicker } from "@/components/route-manager/crew-role-picker";
import { RouteCrewsButton } from "@/components/route-manager/route-crews-button";
import { RouteEmployeeSelect } from "@/components/route-manager/route-employee-select";
import { FieldEntityActions, fieldEntityActionClassName } from "@/components/forms/field-entity-actions";
import { PickupRouteOrdersSection } from "@/components/pickup-delivery-routes/pickup-route-orders-section";
import { FormBody, FormFooterNoticeMessage, FormSection } from "@/components/forms/form-shell";
import { WorkflowStepper } from "@/components/forms/workflow-stepper";
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

type DailyRouteFormStep = 1 | 2;

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
  const [step, setStep] = useState<DailyRouteFormStep>(1);
  const [stepError, setStepError] = useState<string | null>(null);
  const hasBranch = Boolean(branchCode.trim());
  const crewRoles: RouteCrewRole[] = ["driver", "supervisor", "helper"];
  const isFinalStep = step === 2;
  const footerError = stepError || externalError;

  const wizardSteps = [
    { id: 1, label: t("routes.dailyRoutes.wizard.steps.dateAndConfiguration") },
    { id: 2, label: t("routes.dailyRoutes.wizard.steps.vehicleAndRoles") },
  ];

  useEffect(() => {
    setStepError(null);
    const timer = window.setTimeout(() => {
      document.getElementById("daily-route-step-heading")?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [step]);

  const loadedConfigurationKey = `${previousRouteId.trim()}|${values.routeRecordId.trim()}`;
  const previousLoadedConfigurationKeyRef = useRef(loadedConfigurationKey);

  useEffect(() => {
    const previousKey = previousLoadedConfigurationKeyRef.current;
    previousLoadedConfigurationKeyRef.current = loadedConfigurationKey;
    if (step !== 1) return;
    if (!loadedConfigurationKey.replace("|", "").trim()) return;
    if (loadedConfigurationKey === previousKey) return;
    if (!(values.branch.id > 0) || !branchCode.trim() || !values.date.trim()) return;
    setStepError(null);
    setStep(2);
  }, [branchCode, loadedConfigurationKey, step, values.branch.id, values.date]);

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

  function goToStep(nextStep: number) {
    if (nextStep < 1 || nextStep > 2 || nextStep >= step) return;
    setStep(nextStep as DailyRouteFormStep);
  }

  function handleContinue() {
    setStepError(null);
    if (!(values.branch.id > 0) || !branchCode.trim()) {
      setStepError(t("routes.activeRoute.errors.branch"));
      return;
    }
    if (!values.date.trim()) {
      setStepError(t("routes.activeRoute.errors.date"));
      return;
    }
    setStep(2);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isFinalStep) {
      handleContinue();
      return;
    }
    onSubmit();
  }

  const stepHeading =
    step === 1
      ? t("routes.dailyRoutes.wizard.steps.dateAndConfiguration")
      : t("routes.dailyRoutes.wizard.steps.vehicleAndRoles");

  const stepHint =
    step === 1
      ? t("routes.dailyRoutes.wizard.hints.dateAndConfiguration")
      : t("routes.dailyRoutes.wizard.hints.vehicleAndRoles");

  const continueLabel = t("routes.dailyRoutes.wizard.continueToStep", {
    step: t("routes.dailyRoutes.wizard.steps.vehicleAndRoles"),
  });

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleEnterNavigation}
      className="flex min-h-0 flex-1 flex-col"
      aria-labelledby="daily-route-step-heading"
    >
      <WorkflowStepper
        step={step}
        steps={wizardSteps}
        onSelectStep={goToStep}
        ariaLabel={t("routes.dailyRoutes.wizard.navAriaLabel")}
        progressLabel={t("routes.dailyRoutes.wizard.progress", {
          current: step,
          total: wizardSteps.length,
        })}
        goToStepLabel={(label) => t("routes.dailyRoutes.wizard.goToStep", { label })}
      />

      <FormBody
        workflow
        isBusy={isSubmitting}
        className="bg-muted/60 [&_[data-form-section]>div>div>h3]:normal-case [&_[data-form-section]>div>div>h3]:tracking-normal [&_[data-form-section]>div>div>h3]:text-sm [&_[data-form-section]_label]:text-sm [&_[data-form-section]_label]:text-foreground lg:p-8"
      >
        <header className="max-w-2xl space-y-2 rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
          <div className={cn("flex min-w-0 items-center gap-1", step > 1 && "-ml-2")}>
            {step > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("common.actions.previous")}
                disabled={isSubmitting}
                onClick={() => setStep((step - 1) as DailyRouteFormStep)}
              >
                <ArrowLeft className="size-4" />
              </Button>
            ) : null}
            <h2
              id="daily-route-step-heading"
              data-step-heading
              tabIndex={-1}
              className="text-2xl font-semibold tracking-tight outline-none"
            >
              {stepHeading}
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{stepHint}</p>
        </header>

        {step === 1 ? (
          <div className="grid max-w-3xl items-start gap-5">
            <FormSection variant="card">
              <div className="grid items-start gap-4 @2xl:grid-cols-2">
                <RouteFormField htmlFor="active-route-branch" icon={Building2} label={t("routes.activeRoute.branch")} required>
                  <SearchableSelect
                    id="active-route-branch"
                    aria-label={t("routes.activeRoute.branch")}
                    value={branchCode}
                    onValueChange={(value) => {
                      setStepError(null);
                      onBranchChange(value);
                    }}
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
                    onChange={(event) => {
                      setStepError(null);
                      onDateChange(event.target.value);
                    }}
                    required
                  />
                </RouteFormField>
              </div>
            </FormSection>

            <FormSection
              variant="card"
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
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <RouteCrewsButton compact />
                      <FieldEntityActions
                        onAdd={onCreateRouteClick}
                        onEdit={onEditRouteClick}
                        hasSelection={Boolean(values.routeRecordId)}
                        addIcon={Plus}
                        newLabel={t("routes.activeRoute.createRoute")}
                      />
                    </div>
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
          </div>
        ) : null}

        {step === 2 ? (
          <div className="grid items-start gap-5 @4xl:grid-cols-2">
            <FormSection
              variant="card"
              className="@4xl:col-span-2"
              icon={Car}
              title={t("routes.activeRoute.vehicle")}
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
            </FormSection>

            <FormSection
              variant="card"
              className="@4xl:col-span-2"
              description={t("routes.dailyRoutes.form.design.roles")}
              icon={Users}
              title={t("routes.activeRoute.crewRoles")}
              required
            >
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
        ) : null}
      </FormBody>

      <div className="sticky bottom-0 z-10 shrink-0 space-y-3 border-t border-border bg-card px-5 py-3">
        {footerError ? <FormFooterNoticeMessage tone="error" message={footerError} /> : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              {t("common.actions.cancel")}
            </Button>
          ) : null}
          <Button
            type="submit"
            disabled={isSubmitting || (isFinalStep && submitDisabled)}
            className="h-auto min-h-10"
            title={isFinalStep && submitDisabled ? footerError ?? undefined : undefined}
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isFinalStep ? (
              <Save className="size-4" />
            ) : (
              <ArrowRight className="size-4" />
            )}
            {isSubmitting ? t("common.actions.saving") : isFinalStep ? submitLabel : continueLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
