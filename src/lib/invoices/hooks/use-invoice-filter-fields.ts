import { useMemo } from "react";

import { INVOICE_TABLE_FILTER_FIELDS } from "@/lib/invoices/filter-fields";
import { useTranslation } from "@/lib/i18n";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

function localizeInvoiceFilterOption(
  field: string,
  option: { value: string; label: string },
  t: (key: string) => string,
): { value: string; label: string } {
  if (field === "paidRegion") {
    return { ...option, label: t(`invoices.filters.options.paidRegion.${option.value}`) };
  }

  if (field === "paidStatus") {
    return { ...option, label: t(`invoices.filters.options.paidStatus.${option.value}`) };
  }

  if (field === "isArchive" || field === "isVoid") {
    return { ...option, label: t(`invoices.filters.options.boolean.${option.value}`) };
  }

  return option;
}

export function useInvoiceFilterFields(): TableFilterFieldDefinition[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      INVOICE_TABLE_FILTER_FIELDS.map((field) => {
        const labelKey = `invoices.filters.fields.${field.field}.label`;
        const placeholderKey = `invoices.filters.fields.${field.field}.placeholder`;
        const label = t(labelKey);
        const placeholder = field.placeholder ? t(placeholderKey) : undefined;

        return {
          ...field,
          label: label !== labelKey ? label : field.label,
          ...(field.placeholder
            ? {
                placeholder:
                  placeholder && placeholder !== placeholderKey ? placeholder : field.placeholder,
              }
            : {}),
          ...(field.options
            ? {
                options: field.options.map((option) =>
                  localizeInvoiceFilterOption(field.field, option, t),
                ),
              }
            : {}),
        };
      }),
    [t],
  );
}
