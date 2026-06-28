"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  generateLabels,
  updateBarcodes,
  type BarcodeUpdate,
  type GenerateLabelTarget,
} from "@/lib/labels/api/barcodes-api";
import { queryKeys } from "@/lib/query/query-keys";

export function useGenerateLabels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targets: GenerateLabelTarget[]) => generateLabels(targets),
    onSuccess: () => {
      // New barcodes change invoice line-item barcode state, so refresh invoices.
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export function useUpdateBarcodes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: BarcodeUpdate[]) => updateBarcodes(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}
