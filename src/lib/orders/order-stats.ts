import type { TableFilterRowState } from "@/lib/table/filter-builder";

import { DEFAULT_ORDER_LIST_PARAMS, type OrderListParams } from "@/lib/orders/types";

/** Count-only pickup list/search requests for dashboard stat cards. */
export const ORDER_STATS_COUNT_LIMIT = 1;

export function buildOrderStatsCountParams(filterRows: TableFilterRowState[]): OrderListParams {
  return {
    ...DEFAULT_ORDER_LIST_PARAMS,
    limit: ORDER_STATS_COUNT_LIMIT,
    filterRows,
  };
}

export function buildPendingOrderStatsFilterRows(): TableFilterRowState[] {
  return [
    { id: "stats-pending", join: "and", field: "completed", operator: "eq", value: "false" },
  ];
}

/** POST /pickups/search — purpose contains value and not completed. */
export function buildPendingPurposeStatsFilterRows(purposeContains: string): TableFilterRowState[] {
  return [
    {
      id: `stats-purpose-${purposeContains}`,
      join: "and",
      field: "purpose",
      operator: "contains",
      value: purposeContains,
    },
    {
      id: `stats-completed-pending-${purposeContains}`,
      join: "and",
      field: "completed",
      operator: "eq",
      value: "false",
    },
  ];
}
