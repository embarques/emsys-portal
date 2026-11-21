import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import type { DailyIncomeAssigneeSource } from "@/lib/accounting/daily-income/types";
import type { Employee } from "@/lib/employees/types";
import { getActiveRouteSupervisors, type ActiveRoute } from "@/lib/pickup-delivery-routes/types";

export {
  dailyRoutesForAssigneeBranch,
  employeesForAssigneeBranch,
  resolveAssigneeBranchId,
} from "@/lib/accounting/daily-income/assignee-branch";

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
  if (values.employeeId) return "employee";
  return "creator";
}

export function dailyRouteMatchesStatementDate(route: ActiveRoute, date: string): boolean {
  return route.date?.slice(0, 10) === date.slice(0, 10);
}

/** Prefer same-day daily routes; fall back to the full list. */
export function dailyRoutesForStatement(routes: ActiveRoute[], date?: string): ActiveRoute[] {
  if (!date?.trim()) return routes;
  const matched = routes.filter((route) => dailyRouteMatchesStatementDate(route, date));
  return matched.length > 0 ? matched : routes;
}

/** Previous calendar day for a `YYYY-MM-DD` value (noon local avoids DST day-shift). */
export function calendarDayBefore(date: string): string | null {
  const day = date.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const value = new Date(`${day}T12:00:00`);
  if (Number.isNaN(value.getTime())) return null;
  value.setDate(value.getDate() - 1);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}

/** True when the route date is the operator's today or yesterday. */
export function isTodayOrYesterdayRouteDate(routeDate: string, today: string): boolean {
  const day = routeDate.trim().slice(0, 10);
  const ref = today.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{4}-\d{2}-\d{2}$/.test(ref)) return false;
  if (day === ref) return true;
  const yesterday = calendarDayBefore(ref);
  return Boolean(yesterday && day === yesterday);
}

export type DailyRouteSupervisorRef = { id: number; name: string };

export function dailyRouteSupervisors(
  route?: Pick<ActiveRoute, "employees"> | null,
): DailyRouteSupervisorRef[] {
  if (!route) return [];
  return getActiveRouteSupervisors(route).map((employee) => ({ id: employee.id, name: employee.name }));
}

/**
 * A daily route has one supervisor. Ambiguous legacy crews must be corrected
 * before use; a previous selection cannot make an ambiguous route valid.
 */
export function resolveDailyRouteSupervisor(
  route: Pick<ActiveRoute, "employees"> | null | undefined,
): DailyRouteSupervisorRef | null {
  const supervisors = dailyRouteSupervisors(route);
  return supervisors.length === 1 ? supervisors[0] : null;
}

export function buildDailyRouteSupervisorOptions(
  route: Pick<ActiveRoute, "employees"> | null | undefined,
): SearchableSelectOption[] {
  return dailyRouteSupervisors(route).map((supervisor) => ({
    value: String(supervisor.id),
    label: supervisor.name,
    keywords: [supervisor.name],
  }));
}
