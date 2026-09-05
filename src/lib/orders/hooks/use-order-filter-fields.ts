import { useMemo } from "react";

import { ORDER_TABLE_FILTER_FIELDS } from "@/lib/orders/filter-fields";
import { useTranslation } from "@/lib/i18n";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

export function useOrderFilterFields(): TableFilterFieldDefinition[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      ORDER_TABLE_FILTER_FIELDS.map((field) => {
        const labelKey = `orders.filters.fields.${field.field}.label`;
        const placeholderKey = `orders.filters.fields.${field.field}.placeholder`;
        const label = t(labelKey);
        const placeholder = field.placeholder ? t(placeholderKey) : undefined;

        const localized: TableFilterFieldDefinition = {
          ...field,
          label: label !== labelKey ? label : field.label,
        };

        if (field.placeholder) {
          localized.placeholder =
            placeholder && placeholder !== placeholderKey ? placeholder : field.placeholder;
        }

        if (field.field === "completed" && field.options) {
          localized.options = field.options.map((option) => ({
            ...option,
            label:
              option.value === "true"
                ? t("orders.status.completed")
                : t("orders.status.pending"),
          }));
        }

        return localized;
      }),
    [t],
  );
}
