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
} from "@/lib/orders/api/orders-api";
import {
  buildOrderStatsCountParams,
  buildPendingOrderStatsFilterRows,
  buildPendingPurposeStatsFilterRows,
} from "@/lib/orders/order-stats";
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
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = 40 } = options;
  const queryEnabled = useOrdersQueryEnabled();

  return useQuery({
    queryKey: queryKeys.orders.search(search, limit),
    queryFn: () =>
      fetchOrders({
        ...DEFAULT_ORDER_LIST_PARAMS,
        limit,
        search,
      }),
    enabled: queryEnabled && enabled && Boolean(search?.value.trim()),
  });
}

type OrderStatsOptions = {
  enabled?: boolean;
};

export function useOrderStats(options: OrderStatsOptions = {}) {
  const { enabled = true } = options;
  const queryEnabled = useOrdersQueryEnabled() && enabled;

  const pendingQuery = useQuery({
    queryKey: queryKeys.orders.stats("pending"),
    queryFn: () => fetchOrders(buildOrderStatsCountParams(buildPendingOrderStatsFilterRows())),
    enabled: queryEnabled,
  });

  const pendingPickupsQuery = useQuery({
    queryKey: queryKeys.orders.stats("pending-pickups"),
    queryFn: () =>
      fetchOrders(buildOrderStatsCountParams(buildPendingPurposeStatsFilterRows("pickup"))),
    enabled: queryEnabled,
  });

  const pendingTakesQuery = useQuery({
    queryKey: queryKeys.orders.stats("pending-takes"),
    queryFn: () =>
      fetchOrders(buildOrderStatsCountParams(buildPendingPurposeStatsFilterRows("take"))),
    enabled: queryEnabled,
  });

  const pending = pendingQuery.data?.total ?? 0;
  const pendingPickups = pendingPickupsQuery.data?.total ?? 0;
  const pendingTakes = pendingTakesQuery.data?.total ?? 0;

  return {
    pending,
    pendingPickups,
    pendingTakes,
    isLoading:
      pendingQuery.isLoading ||
      pendingPickupsQuery.isLoading ||
      pendingTakesQuery.isLoading,
    isError:
      pendingQuery.isError ||
      pendingPickupsQuery.isError ||
      pendingTakesQuery.isError,
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
