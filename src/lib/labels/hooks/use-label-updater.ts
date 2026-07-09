"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@/lib/i18n";
import { applyBarcodeScanUpdate, applyBarcodeScanUpdates } from "@/lib/labels/api/label-updater-api";
import type { BarcodeScannerOptions } from "@/lib/labels/types";
import { queryKeys } from "@/lib/query/query-keys";
import { useAuth } from "@/lib/auth/hooks/use-auth";

function invalidateBarcodeQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.barcodes.all });
}

export function useApplyBarcodeScan() {
  const queryClient = useQueryClient();
  const { email, displayName } = useAuth();
  const { t } = useTranslation();
  const performedBy = displayName?.trim() || email?.trim() || undefined;

  return useMutation({
    mutationFn: ({
      barcode,
      options,
    }: {
      barcode: string;
      options: BarcodeScannerOptions;
    }) => applyBarcodeScanUpdate(barcode, options, performedBy, t),
    onSuccess: () => invalidateBarcodeQueries(queryClient),
  });
}

export function useApplyBarcodeScanBulk() {
  const queryClient = useQueryClient();
  const { email, displayName } = useAuth();
  const { t } = useTranslation();
  const performedBy = displayName?.trim() || email?.trim() || undefined;

  return useMutation({
    mutationFn: ({
      barcodes,
      options,
    }: {
      barcodes: string[];
      options: BarcodeScannerOptions;
    }) => applyBarcodeScanUpdates(barcodes, options, performedBy, t),
    onSuccess: () => invalidateBarcodeQueries(queryClient),
  });
}
