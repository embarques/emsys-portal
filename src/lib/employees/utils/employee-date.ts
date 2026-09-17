/** Date-only values mean midnight UTC; timestamps retain their instant. */
export function normalizeEmployeeDate(value: string): string {
  const input = value.trim();
  if (!input) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[Tt](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|[+-]\d{2}:\d{2}))?$/.exec(input);
  const invalid = () => new Error("Use a valid YYYY-MM-DD date or RFC3339 timestamp.");
  if (!match) throw invalid();
  const [, year, month, day, hour, minute, second, , zone] = match;
  const calendar = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== input.slice(0, 10)) {
    throw invalid();
  }
  if (!hour) return calendar.toISOString();
  if (+hour > 23 || +minute > 59 || +second > 59) throw invalid();
  if (zone !== "Z" && zone !== "z" && (+zone.slice(1, 3) > 23 || +zone.slice(4) > 59)) throw invalid();
  const timestamp = new Date(input.toUpperCase());
  if (!Number.isFinite(timestamp.getTime())) throw invalid();
  const normalized = timestamp.toISOString();
  if (!/^\d{4}-/.test(normalized)) throw invalid();
  // Keep sub-millisecond precision accepted by RFC3339 and the API.
  const fraction = match[7]?.slice(1).replace(/0+$/, "").padEnd(3, "0");
  return fraction ? normalized.replace(/\.\d{3}Z$/, `.${fraction}Z`) : normalized;
}

/** Format for the shared calendar control without replacing the stored timestamp. */
export function employeeDateToInputValue(value: string): string {
  try {
    return normalizeEmployeeDate(value).slice(0, 10);
  } catch {
    // Leave invalid source values in form state so validation can report them.
    return "";
  }
}

function employeeDateOnlyUtc(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/**
 * True when endDate's UTC calendar day is strictly before today's UTC calendar day.
 * Matches API `employeeEndDatePassed` so today remains active.
 */
export function isEmployeeEndDateBeforeToday(endDate: string, now: Date = new Date()): boolean {
  const trimmed = endDate.trim();
  if (!trimmed) return false;
  try {
    const normalized = normalizeEmployeeDate(trimmed);
    return employeeDateOnlyUtc(new Date(normalized)) < employeeDateOnlyUtc(now);
  } catch {
    return false;
  }
}

/** Force inactive when the end date is already in the past. */
export function resolveEmployeeActiveForEndDate(active: boolean, endDate: string, now: Date = new Date()): boolean {
  if (isEmployeeEndDateBeforeToday(endDate, now)) return false;
  return active;
}
