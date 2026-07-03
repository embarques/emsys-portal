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
  const [values, setValues] = useState<VehicleFormValues>(initialValues ?? createEmptyVehicleForm());
  const handleEnterNavigation = useFormEnterNavigation();
  const branchesQuery = useBranchPicker(200);
  const branches = useMemo(() => branchesQuery.data?.items ?? [], [branchesQuery.data?.items]);
  const currentUserQuery = useCurrentUser();

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
        label: values.branch.code || `Branch ${values.branch.id}`,
        keywords: [values.branch.code],
      });
    }

    return options;
  }, [branches, values.branch.id, values.branch.code]);

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
      <FormBody>
        <FormSection icon={Car} title="Vehicle">
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <div
                id="status"
                className="inline-flex items-center gap-1 rounded-lg border border-input bg-muted p-1"
                role="radiogroup"
                aria-label="Status"
              >
                {[
                  { value: true, label: "Active" },
                  { value: false, label: "Inactive" },
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
            </div>

            <div className="space-y-1">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={values.name}
                onChange={(event) => updateField("name", event.target.value)}
                placeholder="Unit 12 — Freightliner"
                required
              />
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="vin">VIN</Label>
                <Input
                  id="vin"
                  value={values.vin}
                  onChange={(event) => updateField("vin", event.target.value.toUpperCase())}
                  placeholder="1FUJGLDR57LM12345"
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="licensePlate">License plate</Label>
                <Input
                  id="licensePlate"
                  value={values.licensePlate}
                  onChange={(event) => updateField("licensePlate", event.target.value.toUpperCase())}
                  placeholder="ABC-1234"
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="year">Year</Label>
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
                <Label htmlFor="fuelType">Fuel type</Label>
                <SearchableSelect
                  id="fuelType"
                  value={values.fuelType}
                  onValueChange={(next) => updateField("fuelType", next)}
                  placeholder="Select fuel type"
                  searchPlaceholder="Search fuel types…"
                  options={VEHICLE_FUEL_TYPES}
                />
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection icon={CalendarCheck} title="Compliance">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="inspectionDate">Inspection date</Label>
              <DateInput
                id="inspectionDate"
                value={values.inspectionDate}
                onChange={(event) => updateField("inspectionDate", event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="registrationDate">Registration date</Label>
              <DateInput
                id="registrationDate"
                value={values.registrationDate}
                onChange={(event) => updateField("registrationDate", event.target.value)}
              />
            </div>
          </div>
        </FormSection>

        <FormSection icon={Building2} title="Branch">
          <div className="space-y-1">
            <Label htmlFor="branch">
              Branch <span className="text-destructive">*</span>
            </Label>
            <SearchableSelect
              id="branch"
              value={values.branch.id > 0 ? String(values.branch.id) : ""}
              onValueChange={handleBranchChange}
              placeholder="Select branch"
              searchPlaceholder="Search branches…"
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
