import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import { BRANCH_TABLE_FILTER_FIELDS } from "@/lib/branches/filter-fields";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

export function useBranchFilterFields(): TableFilterFieldDefinition[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      BRANCH_TABLE_FILTER_FIELDS.map((field) => ({
        ...field,
        label: t(`branches.filters.fields.${field.field}.label`),
        ...(field.placeholder
          ? { placeholder: t(`branches.filters.fields.${field.field}.placeholder`) }
          : {}),
      })),
    [t],
  );
}
