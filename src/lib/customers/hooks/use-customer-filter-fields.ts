import { useMemo } from "react";

import { CUSTOMER_TABLE_FILTER_FIELDS } from "@/lib/customers/filter-fields";
import { useTranslation } from "@/lib/i18n";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

/** Map API/table field ids to `customers.filters.fields.*` locale paths. */
function getCustomerFilterFieldLocaleKey(field: string): string {
  if (field.startsWith("addresses.")) {
    return `address.${field.slice("addresses.".length)}`;
  }

  return field;
}

export function useCustomerFilterFields(): TableFilterFieldDefinition[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      CUSTOMER_TABLE_FILTER_FIELDS.map((field) => {
        const localeKey = getCustomerFilterFieldLocaleKey(field.field);
        const labelKey = `customers.filters.fields.${localeKey}.label`;
        const placeholderKey = `customers.filters.fields.${localeKey}.placeholder`;
        const label = t(labelKey);
        const placeholder = field.placeholder ? t(placeholderKey) : undefined;

        return {
          ...field,
          label: label !== labelKey ? label : field.label,
          ...(placeholder && placeholder !== placeholderKey
            ? { placeholder }
            : field.placeholder
              ? { placeholder: field.placeholder }
              : {}),
        };
      }),
    [t],
  );
}
