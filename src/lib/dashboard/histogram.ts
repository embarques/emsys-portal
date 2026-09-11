/** Monday-first weekday keys used for all-time dashboard charts. */
export const WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export type WeekdayCounts = Record<WeekdayKey, number>;

export const MONTH_KEYS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
] as const;

export type MonthKey = (typeof MONTH_KEYS)[number];

export type MonthCounts = Record<MonthKey, number>;

/** 1 Jan 2024 is a Monday, used to format weekday labels in UTC. */
const WEEKDAY_LABEL_UTC = Date.UTC(2024, 0, 1);

export function emptyWeekdayCounts(): WeekdayCounts {
  return {
    monday: 0,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 0,
    saturday: 0,
    sunday: 0,
  };
}

export function emptyMonthCounts(): MonthCounts {
  return {
    january: 0,
    february: 0,
    march: 0,
    april: 0,
    may: 0,
    june: 0,
    july: 0,
    august: 0,
    september: 0,
    october: 0,
    november: 0,
    december: 0,
  };
}

type HistogramBucket = {
  bucket?: number;
  count?: number;
};

/**
 * Histogram weekday buckets are Monday-first.
 * 0-6 is used as-is when a 0 bucket is present; otherwise 1-7 is ISO (Monday=1, Sunday=7).
 */
export function weekdayCountsFromBuckets(buckets: readonly HistogramBucket[]): WeekdayCounts {
  const counts = emptyWeekdayCounts();
  const items = buckets.filter(
    (item): item is { bucket: number; count: number } =>
      typeof item.bucket === "number" && typeof item.count === "number",
  );
  const usesZeroIndex = items.some((item) => item.bucket === 0);

  for (const item of items) {
    const index = usesZeroIndex ? item.bucket : item.bucket - 1;
    if (index < 0 || index > 6) continue;
    counts[WEEKDAY_KEYS[index]] += item.count;
  }

  return counts;
}

/** Month buckets are 1 = January … 12 = December. */
export function monthCountsFromBuckets(buckets: readonly HistogramBucket[]): MonthCounts {
  const counts = emptyMonthCounts();

  for (const item of buckets) {
    if (typeof item.bucket !== "number" || typeof item.count !== "number") continue;
    if (item.bucket < 1 || item.bucket > 12) continue;
    counts[MONTH_KEYS[item.bucket - 1]] += item.count;
  }

  return counts;
}

export function weekdayValues(counts: WeekdayCounts): number[] {
  return WEEKDAY_KEYS.map((key) => counts[key]);
}

export function monthValues(counts: MonthCounts): number[] {
  return MONTH_KEYS.map((key) => counts[key]);
}

export function formatWeekdayLabels(
  locale: string,
  style: Intl.DateTimeFormatOptions["weekday"] = "short",
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: style, timeZone: "UTC" });
  return WEEKDAY_KEYS.map((_, index) => formatter.format(new Date(WEEKDAY_LABEL_UTC + index * 86_400_000)));
}

export function formatMonthLabels(
  locale: string,
  style: Intl.DateTimeFormatOptions["month"] = "short",
): string[] {
  const formatter = new Intl.DateTimeFormat(locale, { month: style, timeZone: "UTC" });
  return MONTH_KEYS.map((_, index) => formatter.format(new Date(Date.UTC(2024, index, 15))));
}
