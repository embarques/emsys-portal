import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import { getActiveRouteTableFilterFields } from "@/lib/pickup-delivery-routes/filter-fields";
import type { RouteType } from "@/lib/pickup-delivery-routes/types";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

function localizeFilterOption(
  field: string,
  option: { value: string; label: string },
  t: (key: string) => string,
): { value: string; label: string } {
  if (field === "employees.role") {
    return { ...option, label: t(`routes.filters.enums.crewRole.${option.value}`) };
  }

  if (field === "active") {
    const statusKey = option.value === "true" ? "active" : "inactive";
    return { ...option, label: t(`routes.filters.enums.status.${statusKey}`) };
  }

  if (field === "dayOfWeek") {
    return { ...option, label: t(`routes.activeRoute.days.${option.value}`) };
  }

  return option;
}

export function useActiveRouteFilterFields(routeType: RouteType): TableFilterFieldDefinition[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      getActiveRouteTableFilterFields(routeType).map((field) => ({
        ...field,
        label: t(`routes.filters.fields.${field.field}.label`),
        ...(field.placeholder
          ? { placeholder: t(`routes.filters.fields.${field.field}.placeholder`) }
          : {}),
        ...(field.options
          ? {
              options: field.options.map((option) =>
                localizeFilterOption(field.field, option, t),
              ),
            }
          : {}),
      })),
    [routeType, t],
  );
}
