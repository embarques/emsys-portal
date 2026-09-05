import type { TableFilterRowState } from "@/lib/table/filter-builder";

import {
  getNewOrderPeriodStartIso,
  type NewOrderStatPeriod,
} from "@/lib/orders/new-order-stats";
import { DEFAULT_ORDER_LIST_PARAMS, type OrderListParams } from "@/lib/orders/types";
import { getPreviousRollingPeriodBounds } from "@/lib/stats/rolling-period";

/** Count-only pickup list/search requests for dashboard stat cards. */
export const ORDER_STATS_COUNT_LIMIT = 1;

export function buildOrderStatsCountParams(filterRows: TableFilterRowState[]): OrderListParams {
  return {
    ...DEFAULT_ORDER_LIST_PARAMS,
    limit: ORDER_STATS_COUNT_LIMIT,
    sort: DEFAULT_ORDER_LIST_PARAMS.sort,
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

export function buildNewOrderStatsFilterRows(
  period: NewOrderStatPeriod,
  now: Date = new Date(),
): TableFilterRowState[] {
  return [
    {
      id: "new-orders-created-at",
      join: "and",
      field: "createdAt",
      operator: "gte",
      value: getNewOrderPeriodStartIso(period, now),
    },
  ];
}

/** Prior window of the same length, for period-over-period % change. */
export function buildPreviousNewOrderStatsFilterRows(
  period: NewOrderStatPeriod,
  now: Date = new Date(),
): TableFilterRowState[] {
  const { startIso, endIso } = getPreviousRollingPeriodBounds(period, now);

  return [
    {
      id: "new-orders-created-at-prev-gte",
      join: "and",
      field: "createdAt",
      operator: "gte",
      value: startIso,
    },
    {
      id: "new-orders-created-at-prev-lte",
      join: "and",
      field: "createdAt",
      operator: "lte",
      value: endIso,
    },
  ];
}
