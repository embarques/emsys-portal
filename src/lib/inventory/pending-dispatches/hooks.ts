"use client";

import { keepPreviousData, useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";
import {
  confirmReconciliation,
  fetchDispatchReconciliations,
  fetchPendingDispatches,
  reconcileDispatch,
  rejectReconciliation,
  type ReconciliationConfirmationCommand,
} from "./api";
import type { DispatchReconciliationInput, PendingDispatchFilters } from "./types";

export function usePendingDispatches(filters: PendingDispatchFilters, page: number) {
  const { companyId, hasPermission, loading, roleLoading } = useAuth();
  const { name, resourceType } = PERMISSIONS.inventoryDispatchesList;
  return useWorkspaceQuery({
    queryKey: queryKeys.inventory.pendingDispatches(companyId ?? "", filters, page),
    queryFn: ({ signal }) => fetchPendingDispatches(filters, page, signal),
    enabled: Boolean(companyId) && !loading && !roleLoading && hasPermission(name, resourceType),
    placeholderData: keepPreviousData,
  });
}

export function useDispatchReconciliations(dispatchId: string | null) {
  const { companyId, hasPermission } = useAuth();
  const { name, resourceType } = PERMISSIONS.inventoryDispatchesView;
  return useWorkspaceQuery({
    queryKey: queryKeys.inventory.dispatchReconciliations(companyId ?? "", dispatchId ?? ""),
    queryFn: ({ signal }) => fetchDispatchReconciliations(dispatchId!, signal),
    enabled: Boolean(companyId) && Boolean(dispatchId) && hasPermission(name, resourceType),
  });
}

/** Submitting only moves quantities to "awaiting confirmation"; stock and income change on the final confirmation. */
export function useReconcileDispatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dispatchId, input }: { dispatchId: string; input: DispatchReconciliationInput }) =>
      reconcileDispatch(dispatchId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
  });
}

function useReconciliationConfirmationMutation(mutationFn: (command: ReconciliationConfirmationCommand) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    // The final confirmation moves stock and posts income journals, cash handovers and clearing records.
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all }),
      queryClient.invalidateQueries({ queryKey: ["inventory-workflow"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.accounting.all }),
    ]),
  });
}

export function useConfirmReconciliation() {
  return useReconciliationConfirmationMutation(confirmReconciliation);
}

export function useRejectReconciliation() {
  return useReconciliationConfirmationMutation(rejectReconciliation);
}
