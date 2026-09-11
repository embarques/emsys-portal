import { useMemo } from "react";

import { fetchBarcodeStatusOptions } from "@/lib/barcodes/api/barcode-status-options-api";
import { useTranslation } from "@/lib/i18n";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import { getBarcodeStatusLabel } from "../display";
import { FALLBACK_BARCODE_STATUS_OPTIONS } from "../types";

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
