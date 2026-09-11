import { useMemo } from "react";

import { fetchBarcodeStatusOptions } from "@/lib/barcodes/api/barcode-status-options-api";
import { useTranslation } from "@/lib/i18n";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import {
  getBarcodeStatusLabel,
  getLabelStatusLabel,
} from "../display";
import {
  FALLBACK_BARCODE_STATUS_OPTIONS,
  LABEL_STATUS_VALUES,
} from "../types";

export function useLabelStatusOptions() {
  const { t } = useTranslation();

  return useMemo(
    () =>
      LABEL_STATUS_VALUES.map((value) => ({
        value,
        label: getLabelStatusLabel(value, t),
      })),
    [t],
  );
}

/**
 * Tenant barcode status catalog from `GET /barcodes/status-options`
 * (labels:view). Falls back to the local seed list while loading or on empty.
 */
export function useBarcodeStatusOptions() {
  const { t } = useTranslation();
  const query = useWorkspaceQuery({
    queryKey: queryKeys.barcodes.statusOptions(),
    queryFn: fetchBarcodeStatusOptions,
    staleTime: 5 * 60_000,
  });

  const options = query.data?.length ? query.data : FALLBACK_BARCODE_STATUS_OPTIONS;

  return useMemo(
    () =>
      options.map((option) => ({
        ...option,
        label: getBarcodeStatusLabel(option.name, t),
      })),
    [options, t],
  );
}
