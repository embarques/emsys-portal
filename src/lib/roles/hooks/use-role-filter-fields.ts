import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import { ROLE_TABLE_FILTER_FIELDS } from "@/lib/roles/filter-fields";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

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
      })),
    [t],
  );
}
