import {
  DEFAULT_ORDER_LIST_SORT,
  type OrderFilterState,
  type OrderListParams,
} from "@/lib/orders/types";
import {
  parseAppointmentRouteStopOrder,
  type AppointmentRouteStopOrder,
} from "@/lib/orders/utils/appointment-route-optimization";

const ORDERS_MAP_CONTEXT_KEY = "emsys-orders-map-context";

export type OrdersMapContext = {
  filters: OrderFilterState;
  sort: OrderListParams["sort"];
  selectedIds: string[];
  /** Optimized stop numbers to show on the map. */
  stopOrder?: AppointmentRouteStopOrder | null;
  /** Set when opened from Daily routes "Map route"; route optimization is only offered then. */
  dailyRouteId?: string | null;
};

export const DEFAULT_ORDERS_MAP_CONTEXT: OrdersMapContext = {
  filters: { query: "", rows: [] },
  sort: DEFAULT_ORDER_LIST_SORT,
  selectedIds: [],
  stopOrder: null,
  dailyRouteId: null,
};

export function writeOrdersMapContext(context: OrdersMapContext): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ORDERS_MAP_CONTEXT_KEY, JSON.stringify(context));
}

export function readOrdersMapContext(): OrdersMapContext | null {
  if (typeof window === "undefined") return null;

  const raw = sessionStorage.getItem(ORDERS_MAP_CONTEXT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<OrdersMapContext>;
    return {
      filters: {
        query: typeof parsed.filters?.query === "string" ? parsed.filters.query : "",
        rows: Array.isArray(parsed.filters?.rows) ? parsed.filters.rows : [],
      },
      sort: parsed.sort ?? DEFAULT_ORDER_LIST_SORT,
      selectedIds: Array.isArray(parsed.selectedIds)
        ? parsed.selectedIds.filter((id): id is string => typeof id === "string")
        : [],
      stopOrder: parseAppointmentRouteStopOrder(parsed.stopOrder),
      dailyRouteId:
        typeof parsed.dailyRouteId === "string" && parsed.dailyRouteId.trim()
          ? parsed.dailyRouteId.trim()
          : null,
    };
  } catch {
    return null;
  }
}
