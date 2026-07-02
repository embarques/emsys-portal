"use client";

import { CalendarRange, ClipboardList, Container, Plus, Route as RouteIcon, Users } from "lucide-react";

import { ActiveRouteCrewRoles } from "@/components/routes/active-route-crew-roles";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import type { RouteEmployeeRef } from "@/lib/routes/types";
import type { ActiveRouteFormValues, RouteType } from "@/lib/active-routes/types";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type ActiveRouteFormProps = {
  values: ActiveRouteFormValues;
  isEditing?: boolean;
  isDelivery: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  routeOptions: SearchableSelectOption[];
  containerOptions: SearchableSelectOption[];
  routesLoading?: boolean;
  routeEmployees: RouteEmployeeRef[];
  selectedRouteLoading?: boolean;
  submitDisabled?: boolean;
  onRouteTypeChange: (routeType: RouteType) => void;
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
  submitLabel,
  isSubmitting = false,
  externalError = null,
  routeOptions,
  containerOptions,
  routesLoading = false,
  routeEmployees,
  selectedRouteLoading = false,
  submitDisabled = false,
  onRouteTypeChange,
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

        <FormSection icon={CalendarRange} title={t("routes.activeRoute.date")} required>
          <DateInput
            id="active-route-date"
            aria-label={t("routes.activeRoute.date")}
            value={values.date}
            onChange={(event) => onDateChange(event.target.value)}
            required
          />
        </FormSection>

        {isDelivery ? (
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
