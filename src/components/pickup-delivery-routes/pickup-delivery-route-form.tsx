"use client";

import { Building2, CalendarRange, ClipboardList, Container, Plus, Route as RouteIcon, Users } from "lucide-react";

import { ActiveRouteCrewRoles } from "@/components/pickup-delivery-routes/pickup-delivery-route-crew-roles";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import type { RouteEmployeeRef } from "@/lib/route-manager/types";
import type { ActiveRouteFormValues, RouteType } from "@/lib/pickup-delivery-routes/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ActiveRouteFormProps = {
  values: ActiveRouteFormValues;
  isEditing?: boolean;
  isDelivery: boolean;
  showRouteTypeField?: boolean;
  showContainerField?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  routeOptions: SearchableSelectOption[];
  containerOptions: SearchableSelectOption[];
  branchOptions: SearchableSelectOption[];
  branchCode: string;
  branchesLoading?: boolean;
  routesLoading?: boolean;
  routeEmployees: RouteEmployeeRef[];
  selectedRouteLoading?: boolean;
  submitDisabled?: boolean;
  onRouteTypeChange: (routeType: RouteType) => void;
  onBranchChange: (branchCode: string) => void;
  onDateChange: (date: string) => void;
  onContainerChange: (containerId: string) => void;
  onRouteRecordChange: (routeRecordId: string) => void;
  onDriverChange: (driver: RouteEmployeeRef | null) => void;
  onAppraiserChange: (appraiser: RouteEmployeeRef | null) => void;
  onCreateRouteClick: () => void;
  onSubmit: () => void;
  onCancel?: () => void;
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
  showRouteTypeField = true,
  showContainerField,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  routeOptions,
  containerOptions,
  branchOptions,
  branchCode,
  branchesLoading = false,
  routesLoading = false,
  routeEmployees,
  selectedRouteLoading = false,
  submitDisabled = false,
  onRouteTypeChange,
  onBranchChange,
  onDateChange,
  onContainerChange,
  onRouteRecordChange,
  onDriverChange,
  onAppraiserChange,
  onCreateRouteClick,
  onSubmit,
  onCancel,
}: ActiveRouteFormProps) {
  const { t } = useTranslation();
  const handleEnterNavigation = useFormEnterNavigation();
  const containerVisible = showContainerField ?? isDelivery;

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

        <FormSection icon={CalendarRange} title={t("routes.activeRoute.date")} required>
          <DateInput
            id="active-route-date"
            aria-label={t("routes.activeRoute.date")}
            value={values.date}
            onChange={(event) => onDateChange(event.target.value)}
            required
          />
        </FormSection>

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

        <FormSection icon={Building2} title={t("routes.activeRoute.branch")}>
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
            <ActiveRouteCrewRoles
              employees={routeEmployees}
              driver={values.driver}
              appraiser={values.appraiser}
              loading={selectedRouteLoading}
              onDriverChange={onDriverChange}
              onAppraiserChange={onAppraiserChange}
            />
          </FormSection>
        ) : null}

        {isEditing ? (
          <p className="text-xs text-muted-foreground">{t("routes.activeRouteForm.editHint")}</p>
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
