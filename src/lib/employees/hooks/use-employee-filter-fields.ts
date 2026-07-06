import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import { EMPLOYEE_TABLE_FILTER_FIELDS } from "@/lib/employees/filter-fields";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

function localizeFilterOption(
  field: string,
  option: { value: string; label: string },
  t: (key: string) => string,
): { value: string; label: string } {
  if (field === "active") {
    const statusKey = option.value === "true" ? "active" : "inactive";
    return { ...option, label: t(`employees.enums.status.${statusKey}`) };
  }

  if (field === "department") {
    const key = `employees.enums.department.${option.value}`;
    const translated = t(key);
    return { ...option, label: translated !== key ? translated : option.label };
  }

  if (field === "branch.code") {
    const key = `employees.enums.branchCode.${option.value}`;
    const translated = t(key);
    return { ...option, label: translated !== key ? translated : option.label };
  }

  return option;
}

export function useEmployeeFilterFields(): TableFilterFieldDefinition[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      EMPLOYEE_TABLE_FILTER_FIELDS.map((field) => ({
        ...field,
        label: t(`employees.filters.fields.${field.field}.label`),
        ...(field.placeholder
          ? { placeholder: t(`employees.filters.fields.${field.field}.placeholder`) }
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
