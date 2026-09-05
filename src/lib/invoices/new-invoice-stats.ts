import {
  getRollingPeriodStartIso,
  isRollingStatPeriod,
  ROLLING_STAT_PERIODS,
  type RollingStatPeriod,
} from "@/lib/stats/rolling-period";

export const NEW_INVOICE_STAT_PERIODS = ROLLING_STAT_PERIODS;

export type NewInvoiceStatPeriod = RollingStatPeriod;

export const DEFAULT_NEW_INVOICE_STAT_PERIOD: NewInvoiceStatPeriod = "30d";

/** Rolling window start for "new invoices" KPI filters (`createdAt >= start`). */
export function getNewInvoicePeriodStartIso(
  period: NewInvoiceStatPeriod,
  now: Date = new Date(),
): string {
  return getRollingPeriodStartIso(period, now);
}

export function isNewInvoiceStatPeriod(value: string): value is NewInvoiceStatPeriod {
  return isRollingStatPeriod(value);
}
