import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import { ROLE_TABLE_FILTER_FIELDS } from "@/lib/roles/filter-fields";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

function localizeFilterOption(
  field: string,
  option: { value: string; label: string },
  t: (key: string) => string,
): { value: string; label: string } {
  if (field === "active") {
    const statusKey = option.value === "true" ? "active" : "inactive";
    return { ...option, label: t(`roles.enums.status.${statusKey}`) };
  }

  return option;
}

export function useRoleFilterFields(): TableFilterFieldDefinition[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      ROLE_TABLE_FILTER_FIELDS.map((field) => ({
        ...field,
        label: t(`roles.filters.fields.${field.field}.label`),
        ...(field.placeholder
          ? { placeholder: t(`roles.filters.fields.${field.field}.placeholder`) }
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
