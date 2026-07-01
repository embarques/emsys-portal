import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import { CONTAINER_TABLE_FILTER_FIELDS } from "@/lib/containers/filter-fields";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

export function useContainerFilterFields(): TableFilterFieldDefinition[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      CONTAINER_TABLE_FILTER_FIELDS.map((field) => ({
        ...field,
        label: t(`containers.filters.fields.${field.field}.label`),
        placeholder: t(`containers.filters.fields.${field.field}.placeholder`),
      })),
    [t],
  );
}
