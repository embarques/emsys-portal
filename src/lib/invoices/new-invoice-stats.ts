export const NEW_INVOICE_STAT_PERIODS = ["7d", "30d", "3m", "6m", "1y"] as const;

export type NewInvoiceStatPeriod = (typeof NEW_INVOICE_STAT_PERIODS)[number];

export const DEFAULT_NEW_INVOICE_STAT_PERIOD: NewInvoiceStatPeriod = "30d";

/** Rolling window start for "new invoices" KPI filters (`createdAt >= start`). */
export function getNewInvoicePeriodStartIso(
  period: NewInvoiceStatPeriod,
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

export function isNewInvoiceStatPeriod(value: string): value is NewInvoiceStatPeriod {
  return (NEW_INVOICE_STAT_PERIODS as readonly string[]).includes(value);
}
