"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Car, CircleCheck, ClipboardList, Users } from "lucide-react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { RouteEmployeeSelect } from "@/components/route-manager/route-employee-select";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useTranslation } from "@/lib/i18n";
import { createEmptyRouteForm, type RouteFormValues } from "@/lib/route-manager/types";
import { useVehiclePicker } from "@/lib/vehicles/hooks/use-vehicles";
import { formatBranchCodeLabel, formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useCurrentUser } from "@/lib/users/hooks/use-users";
import { cn } from "@/lib/utils";

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
  const branchCode = values.branch.code.trim();
  const { data: vehiclesData, isLoading: vehiclesLoading } = useVehiclePicker(200, {
    branchCode: branchCode || undefined,
    enabled: Boolean(branchCode),
  });
  const vehicles = vehiclesData?.items ?? [];
  const branchesQuery = useBranchPicker(200);
  const branches = useMemo(() => branchesQuery.data?.items ?? [], [branchesQuery.data?.items]);
  const currentUserQuery = useCurrentUser();
  const handleEnterNavigation = useFormEnterNavigation();

  // Only sync external values when editing — add mode owns its own state.
  useEffect(() => {
    if (!isEditing || !initialValues) return;
    setValues(initialValues);
    setEmployeeError(null);
  }, [initialValues, isEditing]);

  // Keep branch id/name in sync with the branch directory (API requires both on save).
  useEffect(() => {
    if (!branchCode || branches.length === 0) return;

    const match = branches.find(
      (branch) => branch.code.trim().toLowerCase() === branchCode.toLowerCase(),
    );
    if (!match) return;

    setValues((current) => {
      const name = match.name.trim();
      if (
        current.branch.id === match.id &&
        current.branch.code === match.code &&
        current.branch.name?.trim() === name
      ) {
        return current;
      }

      return {
        ...current,
        branch: { id: match.id, code: match.code, name },
      };
    });
  }, [branches, branchCode]);

  // Default new routes to the logged-in user's branch (same pattern as vehicle form).
  useEffect(() => {
    if (isEditing) return;
    if (values.branch.id > 0 && branchCode) return;

    const userBranch = currentUserQuery.data?.branch;
    if (!userBranch?.id) return;

    const match = branches.find((entry) => entry.id === userBranch.id);
    const code = userBranch.code.trim() || match?.code || "";
    if (!code) return;

    setValues((current) =>
      current.branch.id > 0 && current.branch.code.trim()
        ? current
        : {
            ...current,
            branch: {
              id: userBranch.id,
              code,
              name: userBranch.name || match?.name || "",
            },
          },
    );
  }, [branchCode, branches, currentUserQuery.data?.branch, isEditing, values.branch.id]);

  function updateField<K extends keyof RouteFormValues>(key: K, value: RouteFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function handleBranchChange(nextBranchCode: string) {
    const normalized = nextBranchCode.trim().toLowerCase();
    const branch = branches.find((entry) => entry.code.trim().toLowerCase() === normalized);
    // Vehicle and crew belong to a branch — clear them when the branch changes.
    setValues((current) => ({
      ...current,
      branch: {
        id: branch?.id ?? 0,
        code: branch?.code ?? nextBranchCode,
        name: branch?.name ?? "",
      },
      vehicle: { id: "", name: "" },
      employees: [],
    }));
    setEmployeeError(null);
  }

  function handleVehicleChange(vehicleRecordId: string) {
    const vehicle = vehicles.find((entry) => entry.id === vehicleRecordId);
    updateField("vehicle", {
      id: vehicleRecordId,
      name: vehicle?.name ?? "",
      ...(vehicle?.branch.code ? { branch: vehicle.branch.code } : {}),
    });
  }

  function handleEmployeesChange(employees: RouteFormValues["employees"]) {
    setEmployeeError(null);
    updateField("employees", employees);
  }

  const branchOptions = useMemo(
    () =>
      branches.map((branch) => ({
        value: branch.code,
        label: formatBranchFilterLabel(branch),
        keywords: [branch.code, branch.name],
      })),
    [branches],
  );

  const hasBranch = values.branch.id > 0 && Boolean(values.branch.name?.trim());

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!hasBranch) {
      setEmployeeError(t("routes.form.validation.branchRequired"));
      return;
    }
    if (!values.vehicle.id.trim()) {
      setEmployeeError(t("routes.form.validation.vehicleRequired"));
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
      <FormBody isBusy={isSubmitting}>
        {isEditing && (values.routeId.trim() || values.name.trim()) ? (
          <FormSection icon={ClipboardList} title={t("routes.form.sections.details")}>
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
                  onClick={() => updateField("active", option.value)}
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

        <FormSection icon={Building2} title={t("routes.form.sections.branch")} required>
          <SearchableSelect
            id="routeBranch"
            aria-label={t("routes.form.sections.branch")}
            value={values.branch.code}
            onValueChange={handleBranchChange}
            placeholder={t("routes.form.branchPlaceholder")}
            searchPlaceholder={t("routes.form.branchSearch")}
            loading={branchesQuery.isLoading}
            required
            options={branchOptions}
          />
        </FormSection>

        <FormSection icon={Car} title={t("routes.form.sections.vehicle")} required>
          {hasBranch ? (
            <SearchableSelect
              id="vehicleId"
              aria-label={t("routes.routeDetails.vehicle")}
              value={values.vehicle.id}
              onValueChange={handleVehicleChange}
              placeholder={t("routes.form.vehiclePlaceholder")}
              searchPlaceholder={t("routes.form.vehicleSearch")}
              loading={vehiclesLoading}
              loadingMessage={t("common.loading")}
              emptyMessage={t("routes.form.vehicleEmpty")}
              required
              options={vehicles.map((vehicle) => ({
                value: vehicle.id,
                label: `${vehicle.name} · ${formatBranchCodeLabel(vehicle.branch.code, branches)}`,
              }))}
            />
          ) : (
            <p className="text-xs text-muted-foreground">{t("routes.form.selectBranchFirst")}</p>
          )}
        </FormSection>

        <FormSection icon={Users} title={t("routes.form.sections.crew")} required>
          {hasBranch ? (
            <RouteEmployeeSelect
              value={values.employees}
              onChange={handleEmployeesChange}
              error={employeeError}
              branchCode={values.branch.code}
            />
          ) : (
            <p className="text-xs text-muted-foreground">{t("routes.form.selectBranchFirst")}</p>
          )}
        </FormSection>
      </FormBody>

      <FormFooter
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        error={externalError}
        submitDisabled={!hasBranch || !values.vehicle.id.trim() || values.employees.length === 0}
        onCancel={onCancel}
      />
    </form>
  );
}
