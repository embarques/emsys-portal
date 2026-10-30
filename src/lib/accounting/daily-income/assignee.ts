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
  return "employee";
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

export type DailyRouteSupervisorRef = { id: number; name: string };

export function dailyRouteSupervisors(
  route?: Pick<ActiveRoute, "employees"> | null,
): DailyRouteSupervisorRef[] {
  if (!route) return [];
  return getActiveRouteSupervisors(route).map((employee) => ({ id: employee.id, name: employee.name }));
}

/**
 * Keep the chosen supervisor while it is still on the route; otherwise use the
 * route's only supervisor. Routes with several supervisors need an explicit choice.
 */
export function resolveDailyRouteSupervisor(
  route: Pick<ActiveRoute, "employees"> | null | undefined,
  currentSupervisorId?: number,
): DailyRouteSupervisorRef | null {
  const supervisors = dailyRouteSupervisors(route);
  const current = currentSupervisorId
    ? supervisors.find((supervisor) => supervisor.id === currentSupervisorId)
    : undefined;
  if (current) return current;
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
