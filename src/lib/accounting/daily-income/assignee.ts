import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import type { DailyIncomeAssigneeSource } from "@/lib/accounting/daily-income/types";
import type { Employee } from "@/lib/employees/types";
import { DAYS_OF_WEEK, type ActiveRoute } from "@/lib/pickup-delivery-routes/types";

export function buildTransactionAssigneeOptions(employees: Employee[]): SearchableSelectOption[] {
  return [...employees]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((employee) => ({
      value: String(employee.id),
      label: employee.name,
      keywords: [employee.name, employee.department, employee.title],
    }));
}

export function getTransactionAssigneeSelectValue(employeeId?: number): string {
  return employeeId ? String(employeeId) : "";
}

function looksLikeDailyRouteId(id: unknown): boolean {
  if (id == null || id === "") return false;
  return /^[a-f\d]{24}$/i.test(String(id).trim());
}

export function getTransactionAssigneeDisplayName(
  employee?: { name?: string } | null,
  route?: { id?: string | number; name?: string } | null,
  employeeGroup?: { id?: string | number; name?: string } | null,
): string {
  const routeName = route?.name?.trim() ?? "";
  const groupName = employeeGroup?.name?.trim() ?? "";
  const employeeName = employee?.name?.trim() ?? "";
  if (looksLikeDailyRouteId(route?.id) && routeName) return routeName;
  if (employeeName) return employeeName;
  if (looksLikeDailyRouteId(employeeGroup?.id) && groupName) return groupName;
  return routeName || groupName;
}

export function resolveDailyIncomeAssigneeSource(values: {
  assigneeSource?: DailyIncomeAssigneeSource;
  employeeId?: number;
  routeId?: string;
}): DailyIncomeAssigneeSource {
  if (values.assigneeSource) return values.assigneeSource;
  if (values.routeId?.trim()) return "route";
  return "employee";
}

function statementWeekday(date: string): string | null {
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return DAYS_OF_WEEK[(parsed.getDay() + 6) % 7] ?? null;
}

export function dailyRouteMatchesStatementDate(route: ActiveRoute, date: string): boolean {
  const day = date.slice(0, 10);
  if (route.date?.slice(0, 10) === day) return true;
  const weekday = statementWeekday(day);
  if (!weekday) return false;
  return (route.dayOfWeek ?? []).some((value) => value.trim().toLowerCase() === weekday);
}

/** Prefer same-day (or weekday-recurring) daily routes; fall back to the full list. */
export function dailyRoutesForStatement(routes: ActiveRoute[], date?: string): ActiveRoute[] {
  if (!date?.trim()) return routes;
  const matched = routes.filter((route) => dailyRouteMatchesStatementDate(route, date));
  return matched.length > 0 ? matched : routes;
}
