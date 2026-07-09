import type { OrderFilterState } from "@/lib/orders/types";

const ORDERS_LIST_CONTEXT_KEY = "emsys-orders-list-context";

export type OrdersListContext = {
  filters: OrderFilterState;
  /** Open the advanced filter panel after applying the context. */
  openFilters?: boolean;
};

export function writeOrdersListContext(context: OrdersListContext): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ORDERS_LIST_CONTEXT_KEY, JSON.stringify(context));
}

export function readOrdersListContext(): OrdersListContext | null {
  if (typeof window === "undefined") return null;

  const raw = sessionStorage.getItem(ORDERS_LIST_CONTEXT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<OrdersListContext>;
    return {
      filters: {
        query: typeof parsed.filters?.query === "string" ? parsed.filters.query : "",
        rows: Array.isArray(parsed.filters?.rows) ? parsed.filters.rows : [],
      },
      openFilters: parsed.openFilters === true,
    };
  } catch {
    return null;
  }
}

export function clearOrdersListContext(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ORDERS_LIST_CONTEXT_KEY);
}
