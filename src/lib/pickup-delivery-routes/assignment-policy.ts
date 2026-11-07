import { translateCurrent } from "@/lib/i18n/translate-current";

/** Assignment uses the operator's local calendar day, not the UTC day. */
export function assignmentToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isAssignableRouteDate(date: string, today = assignmentToday()): boolean {
  const day = date.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= today;
}

export function assertAssignableRouteDate(date: string): void {
  if (!isAssignableRouteDate(date)) {
    throw new Error(translateCurrent("routes.errors.pastAssignment"));
  }
}
