/** Shared rolling windows for “new in period” KPI cards. */

export const ROLLING_STAT_PERIODS = ["7d", "30d", "3m", "6m", "1y"] as const;

export type RollingStatPeriod = (typeof ROLLING_STAT_PERIODS)[number];

export function isRollingStatPeriod(value: string): value is RollingStatPeriod {
  return (ROLLING_STAT_PERIODS as readonly string[]).includes(value);
}

/** Shift `from` back by one rolling period length. */
export function shiftRollingPeriod(from: Date, period: RollingStatPeriod): Date {
  const start = new Date(from);

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

  return start;
}

/** Rolling window start for the current KPI period (`dateField >= start`). */
export function getRollingPeriodStartIso(
  period: RollingStatPeriod,
  now: Date = new Date(),
): string {
  return shiftRollingPeriod(now, period).toISOString();
}

/**
 * Previous window of the same length, ending just before the current window starts.
 * Use with `dateField >= start` and `dateField <= end`.
 */
export function getPreviousRollingPeriodBounds(
  period: RollingStatPeriod,
  now: Date = new Date(),
): { startIso: string; endIso: string } {
  const currentStart = shiftRollingPeriod(now, period);
  const previousStart = shiftRollingPeriod(currentStart, period);
  const previousEnd = new Date(currentStart.getTime() - 1);

  return {
    startIso: previousStart.toISOString(),
    endIso: previousEnd.toISOString(),
  };
}

export type PeriodChangeKind = "more" | "less" | "same" | "fromZero";

export type PeriodChange = {
  kind: PeriodChangeKind;
  /** Absolute rounded percent; unused when `kind` is `same` or `fromZero`. */
  percent: number;
};

/** Compare current vs previous period counts for KPI copy. */
export function resolvePeriodChange(current: number, previous: number): PeriodChange {
  if (previous === 0) {
    if (current === 0) return { kind: "same", percent: 0 };
    return { kind: "fromZero", percent: 0 };
  }

  const raw = ((current - previous) / previous) * 100;
  const percent = Math.round(Math.abs(raw));

  if (raw > 0) return { kind: "more", percent };
  if (raw < 0) return { kind: "less", percent };
  return { kind: "same", percent: 0 };
}

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** Localized “+/-X% vs last {period}” (or same / from-zero variants). */
export function formatPeriodChangeDescription(
  current: number,
  previous: number,
  periodLabel: string,
  t: Translate,
): string {
  const change = resolvePeriodChange(current, previous);

  switch (change.kind) {
    case "more":
      return t("common.stats.changeMore", { percent: change.percent, period: periodLabel });
    case "less":
      return t("common.stats.changeLess", { percent: change.percent, period: periodLabel });
    case "same":
      return t("common.stats.changeSame", { period: periodLabel });
    case "fromZero":
      return t("common.stats.changeFromZero", { period: periodLabel });
  }
}
