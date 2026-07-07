import { useMemo } from "react";

import { useTranslation } from "@/lib/i18n";

import {
  getBarcodeStatusLabel,
  getLabelStatusLabel,
} from "../display";
import {
  BARCODE_STATUS_OPTIONS,
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

export function useBarcodeStatusOptions() {
  const { t } = useTranslation();

  return useMemo(
    () =>
      BARCODE_STATUS_OPTIONS.map((option) => ({
        ...option,
        label: getBarcodeStatusLabel(option.name, t),
      })),
    [t],
  );
}
