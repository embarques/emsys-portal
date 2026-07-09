"use client";

import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import { BARCODE_TABLE_FILTER_FIELDS } from "@/lib/barcodes/filter-fields";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

export function useBarcodeFilterFields(): TableFilterFieldDefinition[] {
  const { t } = useTranslation();

  return useMemo(
    () =>
      BARCODE_TABLE_FILTER_FIELDS.map((field) => ({
        ...field,
        label: t(`barcodes.filters.fields.${field.field}.label`),
        placeholder: t(`barcodes.filters.fields.${field.field}.placeholder`),
      })),
    [t],
  );
}
