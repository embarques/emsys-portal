import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import { VEHICLE_TABLE_FILTER_FIELDS } from "@/lib/vehicles/filter-fields";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

function localizeFilterOption(
  field: string,
  option: { value: string; label: string },
  t: (key: string) => string,
): { value: string; label: string } {
  if (field === "fuelType") {
    return { ...option, label: t(`vehicles.enums.fuelType.${option.value}`) };
  }

  if (field === "active") {
    const statusKey = option.value === "true" ? "active" : "inactive";
    return { ...option, label: t(`vehicles.enums.status.${statusKey}`) };
  }

  if (field === "branch.code") {
    return { ...option, label: t(`vehicles.enums.branchCode.${option.value}`) };
  }

  return option;
}

export function useVehicleFilterFields(): TableFilterFieldDefinition[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      VEHICLE_TABLE_FILTER_FIELDS.map((field) => ({
        ...field,
        label: t(`vehicles.filters.fields.${field.field}.label`),
        ...(field.placeholder
          ? { placeholder: t(`vehicles.filters.fields.${field.field}.placeholder`) }
          : {}),
        ...(field.options
          ? {
              options: field.options.map((option) =>
                localizeFilterOption(field.field, option, t),
              ),
            }
          : {}),
      })),
    [t],
  );
}
