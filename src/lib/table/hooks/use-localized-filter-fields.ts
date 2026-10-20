import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import type { TableFilterFieldDefinition, TableFilterFieldOption } from "@/lib/table/filter-builder";

type Translate = (key: string) => string;

/**
 * Localizes static filter definitions from `<keyPrefix>.<field>.label` and
 * `<keyPrefix>.<field>.placeholder` (e.g. `inventory.filters.items.fields`).
 */
export function useLocalizedFilterFields(
  fields: readonly TableFilterFieldDefinition[],
  keyPrefix: string,
  localizeOption?: (field: string, option: TableFilterFieldOption, t: Translate) => TableFilterFieldOption,
): TableFilterFieldDefinition[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      fields.map((field) => ({
        ...field,
        label: t(`${keyPrefix}.${field.field}.label`),
        ...(field.placeholder ? { placeholder: t(`${keyPrefix}.${field.field}.placeholder`) } : {}),
        ...(field.options && localizeOption
          ? { options: field.options.map((option) => localizeOption(field.field, option, t)) }
          : {}),
      })),
    [fields, keyPrefix, localizeOption, t],
  );
}
