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

/**
 * Parse API dates for local weekday/month buckets.
 * Calendar dates (`YYYY-MM-DD`) stay on that civil day; timestamps use local time.
 */
export function parseLocalDate(value: string | null | undefined): Date | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** JS `getDay()` is Sunday=0; dashboard charts are Monday=0. */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function countByWeekday(values: readonly (string | null | undefined)[]): WeekdayCounts {
  const counts = emptyWeekdayCounts();

  for (const value of values) {
    const date = parseLocalDate(value);
    if (!date) continue;
    counts[WEEKDAY_KEYS[weekdayIndex(date)]] += 1;
  }

  return counts;
}

export function countByMonth(values: readonly (string | null | undefined)[]): MonthCounts {
  const counts = emptyMonthCounts();

  for (const value of values) {
    const date = parseLocalDate(value);
    if (!date) continue;
    counts[MONTH_KEYS[date.getMonth()]] += 1;
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
