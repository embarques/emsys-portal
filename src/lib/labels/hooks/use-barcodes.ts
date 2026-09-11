"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  assignBarcodesToDailyRoute,
  assignInvoiceItemBarcodesToRoute,
  generateLabels,
  updateBarcodes,
  type AssignBarcodeToRouteTarget,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.barcodes.all });
    },
  });
}

/** Assign barcodes to a daily route (catalog and/or invoice-embedded). */
export function useAssignBarcodesToRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      routeId,
      routeName,
      barcodes,
      barcodeIds,
    }: {
      routeId: string;
      routeName?: string;
      barcodes?: AssignBarcodeToRouteTarget[];
      /** @deprecated Prefer `barcodes` — numeric/uint32 ids for the invoice-embedded endpoint. */
      barcodeIds?: Array<string | number>;
    }) => {
      if (barcodes && barcodes.length > 0) {
        return assignBarcodesToDailyRoute(routeId, routeName ?? routeId, barcodes);
      }
      return assignInvoiceItemBarcodesToRoute(routeId, barcodeIds ?? []);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.barcodes.all });
    },
  });
}
