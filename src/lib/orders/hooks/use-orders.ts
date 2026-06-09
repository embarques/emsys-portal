"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import {
  createOrder,
  deleteOrder,
  deleteOrders,
  fetchOrderById,
  fetchOrders,
  updateOrder,
  updateOrderRouteAssignment,
} from "@/lib/orders/api/orders-api";
import {
  DEFAULT_ORDER_LIST_PARAMS,
  type OrderFormValues,
  type OrderListParams,
  type OrderSearchFilter,
} from "@/lib/orders/types";
import { queryKeys } from "@/lib/query/query-keys";
import { useAppSelector } from "@/lib/store/hooks";

/** EMSYS API returns 400 when Authorization or x-company-id are not ready yet. */
function useOrdersQueryEnabled() {
  const { loading, companyId, roleLoading } = useAuth();
  const { idToken, companyId: transportCompanyId } = useAppSelector((state) => state.auth);

  return (
    !loading &&
    !roleLoading &&
    Boolean(idToken && companyId && transportCompanyId && companyId === transportCompanyId)
  );
}

export function useOrders(params: OrderListParams) {
  const queryEnabled = useOrdersQueryEnabled();

  return useQuery({
    queryKey: queryKeys.orders.list(params),
    queryFn: () => fetchOrders(params),
    enabled: queryEnabled,
  });
}

export function useOrderSearch(
  search: OrderSearchFilter | undefined,
  options: { enabled?: boolean; limit?: number; branch?: OrderListParams["branch"]; completed?: OrderListParams["completed"] } = {},
) {
  const { enabled = true, limit = 40, branch, completed } = options;
  const queryEnabled = useOrdersQueryEnabled();

  return useQuery({
    queryKey: queryKeys.orders.search(search, limit, { branch, completed }),
    queryFn: () =>
      fetchOrders({
        ...DEFAULT_ORDER_LIST_PARAMS,
        limit,
        search,
        branch,
        completed,
      }),
    enabled: queryEnabled && enabled && Boolean(search?.value.trim()),
  });
}

type OrderStatsOptions = {
  usaBranchId?: number;
  drBranchId?: number;
  branchesReady?: boolean;
};

export function useOrderStats(options: OrderStatsOptions = {}) {
  const { usaBranchId, drBranchId, branchesReady = true } = options;
  const queryEnabled = useOrdersQueryEnabled() && branchesReady;

  const totalQuery = useQuery({
    queryKey: queryKeys.orders.stats("all"),
    queryFn: () => fetchOrders({ ...DEFAULT_ORDER_LIST_PARAMS, limit: 1 }),
    enabled: queryEnabled,
  });

  const usaQuery = useQuery({
    queryKey: queryKeys.orders.stats("usa", usaBranchId),
    queryFn: () =>
      fetchOrders({ ...DEFAULT_ORDER_LIST_PARAMS, limit: 1, branch: usaBranchId }),
    enabled: queryEnabled && usaBranchId != null && usaBranchId > 0,
  });

  const drQuery = useQuery({
    queryKey: queryKeys.orders.stats("dr", drBranchId),
    queryFn: () =>
      fetchOrders({ ...DEFAULT_ORDER_LIST_PARAMS, limit: 1, branch: drBranchId }),
    enabled: queryEnabled && drBranchId != null && drBranchId > 0,
  });

  const pendingQuery = useQuery({
    queryKey: queryKeys.orders.stats("pending"),
    queryFn: () => fetchOrders({ ...DEFAULT_ORDER_LIST_PARAMS, limit: 1, completed: false }),
    enabled: queryEnabled,
  });

  return {
    total: totalQuery.data?.total ?? 0,
    usa: usaQuery.data?.total ?? 0,
    dr: drQuery.data?.total ?? 0,
    pending: pendingQuery.data?.total ?? 0,
    isLoading:
      totalQuery.isLoading || usaQuery.isLoading || drQuery.isLoading || pendingQuery.isLoading,
    isError:
      totalQuery.isError || usaQuery.isError || drQuery.isError || pendingQuery.isError,
  };
}

export function useOrder(orderId: string | null, enabled = true) {
  const queryEnabled = useOrdersQueryEnabled();

  return useQuery({
    queryKey: queryKeys.orders.detail(orderId ?? ""),
    queryFn: () => fetchOrderById(orderId!),
    enabled: queryEnabled && enabled && Boolean(orderId),
  });
}

function invalidateOrders(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (values: OrderFormValues) => createOrder(values),
    onSuccess: () => invalidateOrders(queryClient),
  });
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, values }: { orderId: string; values: OrderFormValues }) =>
      updateOrder(orderId, values),
    onSuccess: (_data, variables) => {
      invalidateOrders(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.detail(variables.orderId),
      });
    },
  });
}

export function useUpdateOrderRouteAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orderId, routeAssignmentId }: { orderId: string; routeAssignmentId: string }) =>
      updateOrderRouteAssignment(orderId, routeAssignmentId),
    onSuccess: () => invalidateOrders(queryClient),
  });
}

export function useDeleteOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => deleteOrder(orderId),
    onSuccess: () => invalidateOrders(queryClient),
  });
}

export function useDeleteOrders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderIds: string[]) => deleteOrders(orderIds),
    onSuccess: () => invalidateOrders(queryClient),
  });
}
