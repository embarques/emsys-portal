"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWorkspaceQuery } from "@/lib/query/use-workspace-query";

import { useAuth } from "@/lib/auth/hooks/use-auth";
import {
  assignPickupsToRoute,
  createOrder,
  deleteOrder,
  deleteOrders,
  fetchOrderById,
  fetchOrders,
  fetchPickupsByRoute,
  fetchSenderOrderHistory,
  previewLegacyPickupSync,
  retryOrderLegacySync,
  setOrdersCompleted,
  syncLegacyPickups,
  unassignAllPickupsFromRoute,
  unassignOrdersFromRoutes,
  unassignPickupsFromRoute,
  updateOrder,
} from "@/lib/orders/api/orders-api";
import {
  buildOrderStatsCountParams,
  buildPendingOrderStatsFilterRows,
  buildPendingPurposeStatsFilterRows,
} from "@/lib/orders/order-stats";
import { useInsightsKpis } from "@/lib/insights/hooks/use-insights-kpis";
import type { NewOrderStatPeriod } from "@/lib/orders/new-order-stats";
import {
  DEFAULT_ORDER_LIST_PARAMS,
  type Order,
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

  return useWorkspaceQuery({
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

  return useWorkspaceQuery({
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

const SENDER_HISTORY_LIMIT = 50;
const ROUTE_PICKUPS_LIMIT = 50;

/** Load pickups assigned to a scheduled pickup route. */
export function usePickupsByRoute(
  routeId: string | null | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = ROUTE_PICKUPS_LIMIT } = options;
  const queryEnabled = useOrdersQueryEnabled();
  const id = routeId?.trim() ?? "";

  return useWorkspaceQuery({
    queryKey: queryKeys.orders.byRoute(id, 1, limit),
    queryFn: () => fetchPickupsByRoute(id, { page: 1, limit }),
    enabled: queryEnabled && enabled && id.length > 0,
  });
}

/** Load a sender's appointment history via GET /pickups filtered by their customer id. */
export function useSenderOrderHistory(
  senderId: string | null | undefined,
  options: { enabled?: boolean; limit?: number } = {},
) {
  const { enabled = true, limit = SENDER_HISTORY_LIMIT } = options;
  const queryEnabled = useOrdersQueryEnabled();
  const id = senderId?.trim() ?? "";

  return useWorkspaceQuery({
    queryKey: queryKeys.orders.history(id, limit),
    queryFn: () => fetchSenderOrderHistory(id, { limit }),
    enabled: queryEnabled && enabled && id.length > 0,
  });
}

type OrderStatsOptions = {
  enabled?: boolean;
};

export function useOrderStats(options: OrderStatsOptions = {}) {
  const { enabled = true } = options;
  const queryEnabled = useOrdersQueryEnabled() && enabled;

  const pendingQuery = useWorkspaceQuery({
    queryKey: queryKeys.orders.stats("pending"),
    queryFn: () => fetchOrders(buildOrderStatsCountParams(buildPendingOrderStatsFilterRows())),
    enabled: queryEnabled,
  });

  const pendingPickupsQuery = useWorkspaceQuery({
    queryKey: queryKeys.orders.stats("pending-pickups"),
    queryFn: () =>
      fetchOrders(buildOrderStatsCountParams(buildPendingPurposeStatsFilterRows("pickup"))),
    enabled: queryEnabled,
  });

  const pendingTakesQuery = useWorkspaceQuery({
    queryKey: queryKeys.orders.stats("pending-takes"),
    queryFn: () =>
      fetchOrders(buildOrderStatsCountParams(buildPendingPurposeStatsFilterRows("take"))),
    enabled: queryEnabled,
  });

  const pendingEstimatesQuery = useWorkspaceQuery({
    queryKey: queryKeys.orders.stats("pending-estimates"),
    queryFn: () =>
      fetchOrders(buildOrderStatsCountParams(buildPendingPurposeStatsFilterRows("estimate"))),
    enabled: queryEnabled,
  });

  const pendingPaymentsQuery = useWorkspaceQuery({
    queryKey: queryKeys.orders.stats("pending-payments"),
    queryFn: () =>
      fetchOrders(buildOrderStatsCountParams(buildPendingPurposeStatsFilterRows("payment"))),
    enabled: queryEnabled,
  });

  const pending = pendingQuery.data?.total ?? 0;
  const pendingPickups = pendingPickupsQuery.data?.total ?? 0;
  const pendingTakes = pendingTakesQuery.data?.total ?? 0;
  const pendingEstimates = pendingEstimatesQuery.data?.total ?? 0;
  const pendingPayments = pendingPaymentsQuery.data?.total ?? 0;

  return {
    pending,
    pendingPickups,
    pendingTakes,
    pendingEstimates,
    pendingPayments,
    isLoading:
      pendingQuery.isLoading ||
      pendingPickupsQuery.isLoading ||
      pendingTakesQuery.isLoading ||
      pendingEstimatesQuery.isLoading ||
      pendingPaymentsQuery.isLoading,
    isError:
      pendingQuery.isError ||
      pendingPickupsQuery.isError ||
      pendingTakesQuery.isError ||
      pendingEstimatesQuery.isError ||
      pendingPaymentsQuery.isError,
  };
}

/** Count of appointments created within a rolling timeframe, plus prior-period count for % change. */
export function useNewOrderStats(period: NewOrderStatPeriod) {
  const query = useInsightsKpis(period, { enabled: useOrdersQueryEnabled() });

  return {
    total: query.data?.newAppointments.count ?? 0,
    previousTotal: query.data?.newAppointments.previousCount ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
  };
}

export function useOrder(orderId: string | null, enabled = true) {
  const queryEnabled = useOrdersQueryEnabled();

  return useWorkspaceQuery({
    queryKey: queryKeys.orders.detail(orderId ?? ""),
    queryFn: () => fetchOrderById(orderId!),
    enabled: queryEnabled && enabled && Boolean(orderId),
  });
}

function invalidateOrders(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.insights.all }),
  ]);
}

function isOrderListResult(value: unknown): value is { items: Order[]; total?: number } {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as { items?: unknown }).items),
  );
}

/** Remove appointments from cached list/search results after they leave a route filter. */
function removeOrdersFromListCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  orderIds: number[],
) {
  const idSet = new Set(orderIds.filter((id) => id > 0));
  if (idSet.size === 0) return;

  queryClient.setQueriesData({ queryKey: queryKeys.orders.all }, (current) => {
    if (!isOrderListResult(current)) return current;

    const remaining = current.items.filter((order) => !idSet.has(order.id));
    if (remaining.length === current.items.length) return current;

    const removed = current.items.length - remaining.length;
    const total =
      typeof current.total === "number" ? Math.max(0, current.total - removed) : remaining.length;

    return {
      ...current,
      items: remaining,
      total,
    };
  });
}

/** Drop route fields from cached appointment detail/list rows (unfiltered views). */
function clearRouteFieldsInOrderCaches(
  queryClient: ReturnType<typeof useQueryClient>,
  orderIds: number[],
) {
  const idSet = new Set(orderIds.filter((id) => id > 0));
  if (idSet.size === 0) return;

  const stripRoute = (order: Order): Order =>
    idSet.has(order.id) ? { ...order, routeId: undefined, routeName: undefined } : order;

  queryClient.setQueriesData({ queryKey: queryKeys.orders.all }, (current) => {
    if (!current) return current;

    if (isOrderListResult(current)) {
      return {
        ...current,
        items: current.items.map(stripRoute),
      };
    }

    if (
      typeof current === "object" &&
      "id" in current &&
      typeof (current as Order).id === "number" &&
      idSet.has((current as Order).id)
    ) {
      return stripRoute(current as Order);
    }

    return current;
  });
}

async function invalidateOrdersAndClearCachedRoutes(
  queryClient: ReturnType<typeof useQueryClient>,
  orders: Order[],
) {
  const orderIds = orders.map((order) => order.id);
  // Route-filtered lists should drop these rows immediately.
  removeOrdersFromListCaches(queryClient, orderIds);
  clearRouteFieldsInOrderCaches(queryClient, orderIds);
  await invalidateOrders(queryClient);
  // Unfiltered lists refill from the network with full party data. Only strip a
  // stale route label if a refetch still includes the row.
  clearRouteFieldsInOrderCaches(queryClient, orderIds);
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

export function useSetOrdersCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orders, completed }: { orders: Order[]; completed: boolean }) =>
      setOrdersCompleted(orders, completed),
    onSuccess: () => invalidateOrders(queryClient),
  });
}

export function useSyncLegacyPickups() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => syncLegacyPickups(),
    onSuccess: () => invalidateOrders(queryClient),
  });
}

export function usePreviewLegacyPickupSync() {
  return useMutation({
    mutationFn: () => previewLegacyPickupSync(),
  });
}

export function useRetryOrderLegacySync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderId: string) => retryOrderLegacySync(orderId),
    onSuccess: (order) => {
      invalidateOrders(queryClient);
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.detail(String(order.id)),
      });
    },
  });
}

/** Assign pickups to a scheduled pickup vehicle route (`PUT /pickups/route/{id}`). */
export function useAssignPickupsToRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ routeId, pickupIds }: { routeId: string; pickupIds: number[] }) =>
      assignPickupsToRoute(routeId, pickupIds),
    onSuccess: () => invalidateOrders(queryClient),
  });
}

/** Unassign pickups from their scheduled route (`PUT /pickups/{id}` with `route: null`). */
export function useUnassignPickupsFromRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orders: Order[]) => unassignPickupsFromRoute(orders),
    onSuccess: async (_data, orders) => {
      await invalidateOrdersAndClearCachedRoutes(queryClient, orders);
    },
  });
}

/** Clear route assignments from selected orders (may span multiple routes). */
export function useClearOrdersRouteAssignments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orders: Order[]) => unassignOrdersFromRoutes(orders),
    onSuccess: async (_data, orders) => {
      await invalidateOrdersAndClearCachedRoutes(queryClient, orders);
    },
  });
}

/** Clear every pickup from a scheduled pickup route. */
export function useClearPickupRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (routeId: string) => unassignAllPickupsFromRoute(routeId),
    onSuccess: async () => {
      await invalidateOrders(queryClient);
    },
  });
}
