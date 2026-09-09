"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  assignInvoiceItemBarcodesToRoute,
  generateLabels,
  updateBarcodes,
  type BarcodeUpdate,
  type GenerateLabelTarget,
} from "@/lib/labels/api/barcodes-api";
import { queryKeys } from "@/lib/query/query-keys";

export function useGenerateLabels() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      targets,
      signal,
    }: {
      targets: GenerateLabelTarget[];
      signal?: AbortSignal;
    }) => generateLabels(targets, signal),
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

/** Assign a specific set of barcodes (by id) to a route in one request. */
export function useAssignBarcodesToRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ routeId, barcodeIds }: { routeId: string; barcodeIds: number[] }) =>
      assignInvoiceItemBarcodesToRoute(routeId, barcodeIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}
