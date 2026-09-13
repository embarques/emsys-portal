"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import { queryKeys } from "@/lib/query/query-keys";
import {
  createBarcodeStatus,
  deleteBarcodeStatus,
  fetchBarcodeStatuses,
  updateBarcodeStatus,
  type BarcodeStatusFormValues,
} from "@/lib/barcodes/api/barcode-statuses-api";

export function useBarcodeStatuses() {
  return useWorkspaceQuery({
    queryKey: queryKeys.barcodeStatuses.list(),
    queryFn: fetchBarcodeStatuses,
  });
}

function invalidateBarcodeStatuses(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.barcodeStatuses.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.barcodes.all }),
  ]);
}

export function useCreateBarcodeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: BarcodeStatusFormValues) => createBarcodeStatus(values),
    onSuccess: () => invalidateBarcodeStatuses(queryClient),
  });
}

export function useUpdateBarcodeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: number; values: BarcodeStatusFormValues }) =>
      updateBarcodeStatus(id, values),
    onSuccess: () => invalidateBarcodeStatuses(queryClient),
  });
}

export function useDeleteBarcodeStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteBarcodeStatus(id),
    onSuccess: () => invalidateBarcodeStatuses(queryClient),
  });
}
