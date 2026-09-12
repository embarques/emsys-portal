import {
  getRollingPeriodStartIso,
  isRollingStatPeriod,
  ROLLING_STAT_PERIODS,
  type RollingStatPeriod,
} from "@/lib/stats/rolling-period";

export const NEW_CUSTOMER_STAT_PERIODS = ROLLING_STAT_PERIODS;

export type NewCustomerStatPeriod = RollingStatPeriod;

export const DEFAULT_NEW_CUSTOMER_STAT_PERIOD: NewCustomerStatPeriod = "30d";

/** Rolling window start for "new customers" KPI filters (`createdAt >= start`). */
export function getNewCustomerPeriodStartIso(
  period: NewCustomerStatPeriod,
  now: Date = new Date(),
): string {
  return getRollingPeriodStartIso(period, now);
}

export function isNewCustomerStatPeriod(value: string): value is NewCustomerStatPeriod {
  return isRollingStatPeriod(value);
}
