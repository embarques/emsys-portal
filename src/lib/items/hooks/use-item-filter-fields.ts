import { useMemo } from "react";

import { ITEM_TABLE_FILTER_FIELDS } from "@/lib/items/filter-fields";
import { useTranslation } from "@/lib/i18n";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

export function useItemFilterFields(): TableFilterFieldDefinition[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      ITEM_TABLE_FILTER_FIELDS.map((field) => ({
        ...field,
        label: t(`items.filters.fields.${field.field}.label`),
        placeholder: t(`items.filters.fields.${field.field}.placeholder`),
      })),
    [t],
  );
}
