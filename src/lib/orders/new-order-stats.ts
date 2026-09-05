import {
  getRollingPeriodStartIso,
  isRollingStatPeriod,
  ROLLING_STAT_PERIODS,
  type RollingStatPeriod,
} from "@/lib/stats/rolling-period";

export const NEW_ORDER_STAT_PERIODS = ROLLING_STAT_PERIODS;

export type NewOrderStatPeriod = RollingStatPeriod;

export const DEFAULT_NEW_ORDER_STAT_PERIOD: NewOrderStatPeriod = "30d";

/** Rolling window start for "new appointments" KPI filters (`createdAt >= start`). */
export function getNewOrderPeriodStartIso(
  period: NewOrderStatPeriod,
  now: Date = new Date(),
): string {
  return getRollingPeriodStartIso(period, now);
}

export function isNewOrderStatPeriod(value: string): value is NewOrderStatPeriod {
  return isRollingStatPeriod(value);
}
