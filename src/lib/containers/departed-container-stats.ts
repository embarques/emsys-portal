export const DEPARTED_CONTAINER_STAT_PERIODS = ["7d", "30d", "3m", "6m", "1y"] as const;

export type DepartedContainerStatPeriod = (typeof DEPARTED_CONTAINER_STAT_PERIODS)[number];

export const DEFAULT_DEPARTED_CONTAINER_STAT_PERIOD: DepartedContainerStatPeriod = "30d";

/** Approximate day length of each period — used for annual-pace extrapolation. */
export const DEPARTED_CONTAINER_STAT_PERIOD_DAYS: Record<DepartedContainerStatPeriod, number> = {
  "7d": 7,
  "30d": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

/** Rolling window start for "departed containers" KPI filters (`departureDate >= start`). */
export function getDepartedContainerPeriodStartIso(
  period: DepartedContainerStatPeriod,
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

export function isDepartedContainerStatPeriod(
  value: string,
): value is DepartedContainerStatPeriod {
  return (DEPARTED_CONTAINER_STAT_PERIODS as readonly string[]).includes(value);
}
