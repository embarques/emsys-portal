import { useMemo } from "react";

import { CUSTOMER_TABLE_FILTER_FIELDS } from "@/lib/customers/filter-fields";
import { useTranslation } from "@/lib/i18n";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

export function useCustomerFilterFields(): TableFilterFieldDefinition[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      CUSTOMER_TABLE_FILTER_FIELDS.map((field) => ({
        ...field,
        label: t(`customers.filters.fields.${field.field}.label`),
        placeholder: t(`customers.filters.fields.${field.field}.placeholder`),
      })),
    [t],
  );
}
