"use client";

import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";
import { BARCODE_TABLE_FILTER_FIELDS } from "@/lib/barcodes/filter-fields";
import { DELIVERY_BRANCH_CODE } from "@/lib/pickup-delivery-routes/directory-variant";
import { buildActiveRouteAssignmentOptions } from "@/lib/pickup-delivery-routes/display";
import { useDailyRoutePicker } from "@/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

export function useBarcodeFilterFields(): TableFilterFieldDefinition[] {
  const { t } = useTranslation();

  const { data: dailyRoutes } = useDailyRoutePicker(200, {
    branchCode: DELIVERY_BRANCH_CODE,
  });

  return useMemo(
    () =>
      BARCODE_TABLE_FILTER_FIELDS.map((field) => ({
        ...field,
        ...(field.field === "route.id"
          ? { options: buildActiveRouteAssignmentOptions(dailyRoutes?.items ?? [], t) }
          : {}),
        label: t(`barcodes.filters.fields.${field.field}.label`),
        placeholder: t(`barcodes.filters.fields.${field.field}.placeholder`),
      })),
    [dailyRoutes?.items, t],
  );
}
