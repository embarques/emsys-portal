export const NEW_CUSTOMER_STAT_PERIODS = ["7d", "30d", "3m", "6m", "1y"] as const;

export type NewCustomerStatPeriod = (typeof NEW_CUSTOMER_STAT_PERIODS)[number];

export const DEFAULT_NEW_CUSTOMER_STAT_PERIOD: NewCustomerStatPeriod = "30d";

/** Rolling window start for "new customers" KPI filters (`createdAt >= start`). */
export function getNewCustomerPeriodStartIso(
  period: NewCustomerStatPeriod,
  now: Date = new Date(),
): string {
  const start = new Date(now);

  switch (period) {
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "3m":
      start.setMonth(start.getMonth() - 3);
      break;
    case "6m":
      start.setMonth(start.getMonth() - 6);
      break;
    case "1y":
      start.setFullYear(start.getFullYear() - 1);
      break;
  }

  return start.toISOString();
}

export function isNewCustomerStatPeriod(value: string): value is NewCustomerStatPeriod {
  return (NEW_CUSTOMER_STAT_PERIODS as readonly string[]).includes(value);
}
