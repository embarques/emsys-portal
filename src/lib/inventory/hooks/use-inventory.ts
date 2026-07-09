import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/query-keys";
import {
  createAdjustment,
  createCatalogItem,
  createDispatch,
  createReceipt,
  createRecipient,
  deleteCatalogItems,
  deleteRecipients,
  getInventoryStoreSnapshot,
  getItemStock,
  updateCatalogItem,
  updateDispatchStatus,
  updateRecipient,
} from "../mock-store";
import type { InventoryFormValues, InventoryItem } from "../types/catalog";
import type { DispatchFormValues, DispatchStatus, InventoryDispatch, InventoryReceipt, ReceiptFormValues } from "../types/documents";
import type { InventoryRecipient, RecipientFormValues } from "../types/recipients";
import type { AdjustmentFormValues, InventoryAdjustment } from "../types/movements";

function invalidateInventory(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all });
}

export function useInventorySnapshot() {
  return useQuery({
    queryKey: queryKeys.inventory.snapshot(),
    queryFn: getInventoryStoreSnapshot,
    staleTime: 0,
  });
}

export function useInventoryItems() {
  return useQuery({
    queryKey: queryKeys.inventory.items(),
    queryFn: () => getInventoryStoreSnapshot().items,
    staleTime: 0,
  });
}

export function useInventoryMovements(itemId?: string) {
  return useQuery({
    queryKey: queryKeys.inventory.movements(itemId),
    queryFn: () => {
      const snapshot = getInventoryStoreSnapshot();
      return itemId
        ? snapshot.movements.filter((movement) => movement.itemId === itemId)
        : snapshot.movements;
    },
    staleTime: 0,
  });
}

export function useInventoryReceipts() {
  return useQuery({
    queryKey: queryKeys.inventory.receipts(),
    queryFn: () => getInventoryStoreSnapshot().receipts,
    staleTime: 0,
  });
}

export function useInventoryDispatches() {
  return useQuery({
    queryKey: queryKeys.inventory.dispatches(),
    queryFn: () => getInventoryStoreSnapshot().dispatches,
    staleTime: 0,
  });
}

export function useInventoryRecipients() {
  return useQuery({
    queryKey: queryKeys.inventory.recipients(),
    queryFn: () => getInventoryStoreSnapshot().recipients,
    staleTime: 0,
  });
}

export function useItemStock(itemId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.inventory.stock(itemId ?? ""),
    queryFn: () => (itemId ? getItemStock(itemId) : 0),
    enabled: Boolean(itemId),
    staleTime: 0,
  });
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation<InventoryItem, Error, InventoryFormValues>({
    mutationFn: async (values) => createCatalogItem(values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation<InventoryItem, Error, { id: string; values: InventoryFormValues }>({
    mutationFn: async ({ id, values }) => updateCatalogItem(id, values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useDeleteInventoryItems() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string[]>({
    mutationFn: async (ids) => {
      deleteCatalogItems(ids);
    },
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useCreateReceipt() {
  const queryClient = useQueryClient();
  return useMutation<InventoryReceipt, Error, ReceiptFormValues>({
    mutationFn: async (values) => createReceipt(values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useCreateDispatch() {
  const queryClient = useQueryClient();
  return useMutation<InventoryDispatch, Error, DispatchFormValues>({
    mutationFn: async (values) => createDispatch(values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useUpdateDispatchStatus() {
  const queryClient = useQueryClient();
  return useMutation<InventoryDispatch, Error, { id: string; status: DispatchStatus }>({
    mutationFn: async ({ id, status }) => updateDispatchStatus(id, status),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useCreateAdjustment() {
  const queryClient = useQueryClient();
  return useMutation<InventoryAdjustment, Error, AdjustmentFormValues>({
    mutationFn: async (values) => createAdjustment(values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useCreateRecipient() {
  const queryClient = useQueryClient();
  return useMutation<InventoryRecipient, Error, RecipientFormValues>({
    mutationFn: async (values) => createRecipient(values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useUpdateRecipient() {
  const queryClient = useQueryClient();
  return useMutation<InventoryRecipient, Error, { id: string; values: RecipientFormValues }>({
    mutationFn: async ({ id, values }) => updateRecipient(id, values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useDeleteRecipients() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string[]>({
    mutationFn: async (ids) => {
      deleteRecipients(ids);
    },
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useInventorySnapshotData() {
  const { data } = useInventorySnapshot();
  return data ?? getInventoryStoreSnapshot();
}
