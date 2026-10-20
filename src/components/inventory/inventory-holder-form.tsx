"use client";

import { Warehouse } from "lucide-react";
import { useMemo, useState } from "react";

import { FormBody, FormFooter, FormSection } from "@/components/forms/form-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { selectFormFieldTextOnFocus, useFormEnterNavigation } from "@/hooks/use-form-enter-navigation";
import { useEmployees } from "@/lib/employees/hooks/use-employees";
import { useTranslation } from "@/lib/i18n";
import { getHolderTypeLabel } from "@/lib/inventory/display";
import { useRouteCrews } from "@/lib/inventory/hooks/use-inventory";
import { buildInventoryHolderPayload } from "@/lib/inventory/schemas/inventory.schema";
import {
  createEmptyHolderForm,
  type InventoryHolderFormValues,
  type InventoryHolderType,
} from "@/lib/inventory/types/holders";
import { useVehiclePicker } from "@/lib/vehicles/hooks/use-vehicles";

type EntityOption = { value: string; label: string };

type EntityPickerProps = {
  value: string;
  onSelect: (option: EntityOption) => void;
};

function EntitySelect({ options, loading, value, onSelect }: EntityPickerProps & { options: EntityOption[]; loading: boolean }) {
  const { t } = useTranslation();
  return (
    <SearchableSelect
      id="holder-entity"
      value={value}
      onValueChange={(next) => {
        const option = options.find((entry) => entry.value === next);
        if (option) onSelect(option);
      }}
      options={options}
      loading={loading}
      placeholder={t("inventory.form.placeholders.holderEntity")}
      searchPlaceholder={t("inventory.search.options")}
      emptyMessage={t("inventory.empty.noOptions")}
      loadingMessage={t("common.loading")}
      required
      mobileSheet
    />
  );
}

function EmployeeEntityPicker(props: EntityPickerProps) {
  const query = useEmployees({ page: 1, limit: 200, sort: "name:asc" });
  const options = useMemo(
    () =>
      (query.data?.items ?? [])
        .filter((employee) => employee.active)
        .map((employee) => ({ value: String(employee.id), label: employee.name })),
    [query.data?.items],
  );
  return <EntitySelect {...props} options={options} loading={query.isLoading} />;
}

function VehicleEntityPicker(props: EntityPickerProps) {
  const query = useVehiclePicker(200, { enabled: true });
  const options = useMemo(
    () =>
      (query.data?.items ?? [])
        .filter((vehicle) => vehicle.active)
        .map((vehicle) => ({ value: vehicle.id, label: vehicle.name || vehicle.vehicleId || vehicle.id })),
    [query.data?.items],
  );
  return <EntitySelect {...props} options={options} loading={query.isLoading} />;
}

function RouteCrewEntityPicker(props: EntityPickerProps) {
  const query = useRouteCrews();
  const options = useMemo(
    () => (query.data ?? []).filter((crew) => crew.isActive).map((crew) => ({ value: crew.id, label: crew.name })),
    [query.data],
  );
  return <EntitySelect {...props} options={options} loading={query.isLoading} />;
}

type InventoryHolderFormProps = {
  allowedTypes: readonly InventoryHolderType[];
  isSubmitting?: boolean;
  externalError?: string | null;
  onSubmit: (values: InventoryHolderFormValues) => void;
  onCancel: () => void;
};

export function InventoryHolderForm({
  allowedTypes,
  isSubmitting = false,
  externalError,
  onSubmit,
  onCancel,
}: InventoryHolderFormProps) {
  const { t } = useTranslation();
  const handleEnterNavigation = useFormEnterNavigation();
  const [values, setValues] = useState<InventoryHolderFormValues>(() => createEmptyHolderForm(allowedTypes[0]));
  const [validationError, setValidationError] = useState<string | null>(null);
  const validation = buildInventoryHolderPayload(values);
  const warning = validation.ok ? null : t(validation.error);

  const typeOptions = allowedTypes.map((type) => ({ value: type, label: getHolderTypeLabel(type, t) }));
  const entityPickerProps: EntityPickerProps = {
    value: values.entityId,
    onSelect: (option) =>
      setValues((current) => ({
        ...current,
        entityId: option.value,
        displayName: current.displayName.trim() ? current.displayName : option.label,
      })),
  };

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!validation.ok) {
      setValidationError(t(validation.error));
      return;
    }
    setValidationError(null);
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} onKeyDown={handleEnterNavigation} className="flex min-h-0 flex-1 flex-col">
      <FormBody isBusy={isSubmitting} className="@container min-h-0 space-y-5 p-4 sm:p-6">
        <FormSection
          icon={Warehouse}
          title={`01 · ${t("inventory.form.sections.holder")}`}
          className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm"
        >
          <p className="text-sm text-muted-foreground">{t("inventory.form.workflow.holderHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="holder-type">
                {t("inventory.form.fields.holderType")} <span className="text-destructive">*</span>
              </Label>
              <SearchableSelect
                id="holder-type"
                value={values.type}
                onValueChange={(next) =>
                  setValues({ ...createEmptyHolderForm(next as InventoryHolderType), displayName: values.displayName })
                }
                options={typeOptions}
                placeholder={t("inventory.form.placeholders.holderType")}
                searchPlaceholder={t("inventory.search.options")}
                emptyMessage={t("inventory.empty.noOptions")}
                required
              />
            </div>
            {values.type !== "WAREHOUSE" ? (
              <div className="space-y-1">
                <Label htmlFor="holder-entity">
                  {t(`inventory.form.fields.holderEntity.${values.type}`)} <span className="text-destructive">*</span>
                </Label>
                {values.type === "EMPLOYEE" ? <EmployeeEntityPicker {...entityPickerProps} /> : null}
                {values.type === "VEHICLE" ? <VehicleEntityPicker {...entityPickerProps} /> : null}
                {values.type === "ROUTE_CREW" ? <RouteCrewEntityPicker {...entityPickerProps} /> : null}
              </div>
            ) : null}
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="holder-name">
                {t("inventory.form.fields.holderName")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="holder-name"
                value={values.displayName}
                onChange={(event) => setValues((current) => ({ ...current, displayName: event.target.value }))}
                onFocus={selectFormFieldTextOnFocus}
                required
              />
            </div>
          </div>
        </FormSection>
      </FormBody>
      <FormFooter
        error={validationError ?? externalError ?? null}
        warning={warning}
        submitLabel={t("inventory.actions.addHolder")}
        onCancel={onCancel}
        isSubmitting={isSubmitting}
      />
    </form>
  );
}
