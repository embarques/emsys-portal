import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/query-keys";
import {
  createAdjustment,
  createCatalogItem,
  createDispatch,
  createReceipt,
  createSupplier,
  deleteCatalogItems,
  deleteSuppliers,
  getInventoryStoreSnapshot,
  getItemStock,
  updateCatalogItem,
  updateSupplier,
} from "../mock-store";
import type { InventoryFormValues, InventoryItem } from "../types/catalog";
import type { DispatchFormValues, InventoryDispatch, InventoryReceipt, ReceiptFormValues } from "../types/documents";
import type { InventorySupplier, SupplierFormValues } from "../types/suppliers";
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

export function useInventorySuppliers() {
  return useQuery({
    queryKey: queryKeys.inventory.suppliers(),
    queryFn: () => getInventoryStoreSnapshot().suppliers,
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

export function useCreateAdjustment() {
  const queryClient = useQueryClient();
  return useMutation<InventoryAdjustment, Error, AdjustmentFormValues>({
    mutationFn: async (values) => createAdjustment(values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation<InventorySupplier, Error, SupplierFormValues>({
    mutationFn: async (values) => createSupplier(values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  return useMutation<InventorySupplier, Error, { id: string; values: SupplierFormValues }>({
    mutationFn: async ({ id, values }) => updateSupplier(id, values),
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useDeleteSuppliers() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string[]>({
    mutationFn: async (ids) => {
      deleteSuppliers(ids);
    },
    onSuccess: () => invalidateInventory(queryClient),
  });
}

export function useInventorySnapshotData() {
  const { data } = useInventorySnapshot();
  return data ?? getInventoryStoreSnapshot();
}
