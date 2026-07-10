"use client";

import { Building2, CalendarCheck, Car } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatBranchFilterLabel } from "@/lib/branches/display";
import { useBranchPicker } from "@/lib/branches/hooks/use-branches";
import { useTranslation } from "@/lib/i18n";
import { useCurrentUser } from "@/lib/users/hooks/use-users";
import { cn } from "@/lib/utils";
import {
  VEHICLE_FUEL_TYPES,
  createEmptyVehicleForm,
  type VehicleFormValues,
} from "@/lib/vehicles/types";

type VehicleFormProps = {
  initialValues?: VehicleFormValues;
  isEditing?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: VehicleFormValues) => void;
  onCancel: () => void;
};

export function VehicleForm({
  initialValues,
  isEditing = false,
  submitLabel,
  isSubmitting = false,
  externalError = null,
  onSubmit,
  onCancel,
}: VehicleFormProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<VehicleFormValues>(initialValues ?? createEmptyVehicleForm());
  const handleEnterNavigation = useFormEnterNavigation();
  const branchesQuery = useBranchPicker(200);
  const branches = useMemo(() => branchesQuery.data?.items ?? [], [branchesQuery.data?.items]);
  const currentUserQuery = useCurrentUser();

  const fuelTypeOptions = useMemo(
    () =>
      VEHICLE_FUEL_TYPES.map((option) => ({
        ...option,
        label: t(`vehicles.enums.fuelType.${option.value}`),
      })),
    [t],
  );

  const statusOptions = useMemo(
    () => [
      { value: true, label: t("vehicles.enums.status.active") },
      { value: false, label: t("vehicles.enums.status.inactive") },
    ],
    [t],
  );

  useEffect(() => {
    setValues(initialValues ?? createEmptyVehicleForm());
  }, [initialValues]);

  // Default new vehicles to the logged-in user's branch. The current user branch
  // is a `{ id, code }` ref; if the code is missing we resolve it from the branch
  // list, falling back to the first accessible branch.
  useEffect(() => {
    if (isEditing) return;
    if (values.branch.id > 0) return;

    const userBranch = currentUserQuery.data?.branch;
    const resolved = (() => {
      if (userBranch && userBranch.id > 0) {
        const match = branches.find((entry) => entry.id === userBranch.id);
        const code = userBranch.code || match?.code || "";
        return { id: userBranch.id, code };
      }
      const defaultBranch = branches[0];
      return defaultBranch ? { id: defaultBranch.id, code: defaultBranch.code } : null;
    })();

    if (!resolved) return;
    setValues((current) =>
      current.branch.id > 0 ? current : { ...current, branch: resolved },
    );
  }, [branches, currentUserQuery.data?.branch, isEditing, values.branch.id]);

  function updateField<K extends keyof VehicleFormValues>(key: K, value: VehicleFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  const branchOptions = useMemo(() => {
    const options = branches.map((branch) => ({
      value: String(branch.id),
      label: formatBranchFilterLabel(branch),
      keywords: [branch.code, branch.name],
    }));

    // Keep the current branch selectable even if it's outside the loaded page.
    if (
      values.branch.id > 0 &&
      !options.some((option) => option.value === String(values.branch.id))
    ) {
      options.unshift({
        value: String(values.branch.id),
        label: values.branch.code || t("vehicles.form.branchFallback", { id: values.branch.id }),
        keywords: [values.branch.code],
      });
    }

    return options;
  }, [branches, t, values.branch.id, values.branch.code]);

  function handleBranchChange(nextValue: string) {
    const branchId = Number(nextValue) || 0;
    const branch = branches.find((entry) => entry.id === branchId);
    updateField("branch", { id: branchId, code: branch?.code ?? values.branch.code });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting}>
        <FormSection icon={Car} title={t("vehicles.form.sections.vehicle")}>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="status">{t("vehicles.form.fields.status")}</Label>
              <div
                id="status"
                className="inline-flex items-center gap-1 rounded-lg border border-input bg-muted p-1"
                role="radiogroup"
                aria-label={t("vehicles.form.fields.status")}
              >
                {statusOptions.map((option) => {
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
            </div>

            <div className="space-y-1">
              <Label htmlFor="name">
                {t("vehicles.form.fields.name")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={values.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder={t("vehicles.form.placeholders.name")}
                required
              />
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="vin">{t("vehicles.form.fields.vin")}</Label>
                <Input
                  id="vin"
                  value={values.vin}
                  onChange={(event) => updateField("vin", event.target.value.toUpperCase())}
                  placeholder={t("vehicles.form.placeholders.vin")}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="licensePlate">{t("vehicles.form.fields.licensePlate")}</Label>
                <Input
                  id="licensePlate"
                  value={values.licensePlate}
                  onChange={(event) => updateField("licensePlate", event.target.value.toUpperCase())}
                  placeholder={t("vehicles.form.placeholders.licensePlate")}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="year">{t("vehicles.form.fields.year")}</Label>
                <Input
                  id="year"
                  type="number"
                  min={1980}
                  max={new Date().getFullYear() + 1}
                  value={values.year}
                  onChange={(event) => updateField("year", event.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="fuelType">{t("vehicles.form.fields.fuelType")}</Label>
                <SearchableSelect
                  id="fuelType"
                  value={values.fuelType}
                  onValueChange={(next) => updateField("fuelType", next)}
                  placeholder={t("vehicles.form.placeholders.fuelType")}
                  searchPlaceholder={t("vehicles.form.placeholders.fuelTypeSearch")}
                  options={fuelTypeOptions}
                />
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection icon={CalendarCheck} title={t("vehicles.form.sections.compliance")}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="inspectionDate">{t("vehicles.form.fields.inspectionDate")}</Label>
              <DateInput
                id="inspectionDate"
                value={values.inspectionDate}
                onChange={(event) => updateField("inspectionDate", event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="registrationDate">{t("vehicles.form.fields.registrationDate")}</Label>
              <DateInput
                id="registrationDate"
                value={values.registrationDate}
                onChange={(event) => updateField("registrationDate", event.target.value)}
              />
            </div>
          </div>
        </FormSection>

        <FormSection icon={Building2} title={t("vehicles.form.sections.branch")}>
          <div className="space-y-1">
            <Label htmlFor="branch">
              {t("vehicles.form.fields.branch")} <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              id="branch"
              value={values.branch.id > 0 ? String(values.branch.id) : ""}
              onValueChange={handleBranchChange}
              placeholder={t("vehicles.form.placeholders.branch")}
              searchPlaceholder={t("vehicles.form.placeholders.branchSearch")}
              loading={branchesQuery.isLoading}
              options={branchOptions}
            />
          </div>
        </FormSection>
      </FormBody>

      <FormFooter
        error={externalError}
        submitLabel={submitLabel}
        isSubmitting={isSubmitting}
        submitDisabled={!(values.branch.id > 0)}
        onCancel={onCancel}
      />
    </form>
  );
}
