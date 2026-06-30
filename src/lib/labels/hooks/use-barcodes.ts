"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  assignInvoiceItemBarcodesToRoute,
  collectAssignableInvoiceBarcodeIds,
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

/**
 * Assign the barcodes of the selected invoices to a route. Resolves each
 * invoice's container-bearing barcodes, then assigns them in one request.
 */
export function useAssignInvoiceBarcodesToRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ routeId, invoiceIds }: { routeId: string; invoiceIds: string[] }) => {
      const barcodeIds = await collectAssignableInvoiceBarcodeIds(invoiceIds);
      return assignInvoiceItemBarcodesToRoute(routeId, barcodeIds);
    },
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
