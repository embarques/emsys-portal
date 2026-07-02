"use client";

import { useEffect, useState } from "react";
import { Car, ClipboardList, Users } from "lucide-react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { RouteEmployeeSelect } from "@/components/routes/route-employee-select";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useTranslation } from "@/lib/i18n";
import { createEmptyRouteForm, type RouteFormValues } from "@/lib/routes/types";
import { useVehiclePicker } from "@/lib/vehicles/hooks/use-vehicles";
import { getBranchLabel } from "@/lib/vehicles/display";

type RouteFormProps = {
  initialValues?: RouteFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: RouteFormValues) => void;
  onCancel: () => void;
};

export function RouteForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  onSubmit,
  onCancel,
}: RouteFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<RouteFormValues>(
    initialValues ?? createEmptyRouteForm(),
  );
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const { data: vehiclesData } = useVehiclePicker();
  const vehicles = vehiclesData?.items ?? [];
  const handleEnterNavigation = useFormEnterNavigation();

  useEffect(() => {
    setValues(initialValues ?? createEmptyRouteForm());
    setEmployeeError(null);
  }, [initialValues, isEditing]);

  function updateField<K extends keyof RouteFormValues>(key: K, value: RouteFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleVehicleChange(vehicleRecordId: string) {
    const vehicle = vehicles.find((entry) => entry.id === vehicleRecordId);
    updateField("vehicle", {
      id: vehicleRecordId,
      name: vehicle?.name ?? "",
      ...(vehicle?.branch ? { branch: vehicle.branch } : {}),
    });
  }

  function handleEmployeesChange(employees: RouteFormValues["employees"]) {
    setEmployeeError(null);
    updateField("employees", employees);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!values.vehicle.id.trim()) {
      return;
    }
    if (values.employees.length === 0) {
      setEmployeeError(t("routes.form.crewMemberRequired"));
      return;
    }
    setEmployeeError(null);
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody>
        {isEditing && (values.routeId.trim() || values.name.trim()) ? (
          <FormSection icon={ClipboardList} title={t("routes.routeDetails.title")}>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {values.routeId.trim() ? (
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="route-display-id">{t("routes.routeDetails.routeId")}</Label>
                  <p id="route-display-id" className="font-mono text-sm">
                    {values.routeId}
                  </p>
                </div>
              ) : null}

              {values.name.trim() ? (
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="route-display-name">{t("routes.routeDetails.name")}</Label>
                  <p id="route-display-name" className="text-sm font-medium">
                    {values.name}
                  </p>
                </div>
              ) : null}
            </div>
          </FormSection>
        ) : null}

        <FormSection icon={Car} title={t("routes.routeDetails.vehicle")} required>
          <SearchableSelect
            id="vehicleId"
            aria-label={t("routes.routeDetails.vehicle")}
            value={values.vehicle.id}
            onValueChange={handleVehicleChange}
            placeholder={t("routes.form.vehiclePlaceholder")}
            searchPlaceholder={t("routes.form.vehicleSearch")}
            required
            options={vehicles.map((vehicle) => ({
              value: vehicle.id,
              label: `${vehicle.name} · ${getBranchLabel(vehicle.branch)}`,
            }))}
          />
        </FormSection>

        <FormSection icon={Users} title={t("routes.form.crewMembers")} required>
          <RouteEmployeeSelect
            value={values.employees}
            onChange={handleEmployeesChange}
            error={employeeError}
          />
        </FormSection>
      </FormBody>

      <FormFooter
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        error={externalError}
        submitDisabled={!values.vehicle.id.trim() || values.employees.length === 0}
        onCancel={onCancel}
      />
    </form>
  );
}
