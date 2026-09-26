import type { Employee } from "@/lib/employees/types";
import type { ActiveRoute } from "@/lib/pickup-delivery-routes/types";

/** Portal-only branch filter for assignee pickers (not persisted on the journal). */
export function employeesForAssigneeBranch(
  employees: Employee[],
  branchId?: number | null,
): Employee[] {
  if (branchId == null || !(branchId > 0)) return employees;
  return employees.filter((employee) => employee.branch?.id === branchId);
}

export function dailyRoutesForAssigneeBranch(
  routes: ActiveRoute[],
  branchId?: number | null,
): ActiveRoute[] {
  if (branchId == null || !(branchId > 0)) return routes;
  return routes.filter((route) => route.branch?.id === branchId);
}

/** Seed branch filter from statement, then selected employee/route. */
export function resolveAssigneeBranchId(input: {
  statementBranchId?: number | null;
  employee?: Pick<Employee, "branch"> | null;
  route?: Pick<ActiveRoute, "branch"> | null;
}): number | undefined {
  if (input.statementBranchId != null && input.statementBranchId > 0) {
    return input.statementBranchId;
  }
  const employeeBranchId = input.employee?.branch?.id;
  if (employeeBranchId != null && employeeBranchId > 0) return employeeBranchId;
  const routeBranchId = input.route?.branch?.id;
  if (routeBranchId != null && routeBranchId > 0) return routeBranchId;
  return undefined;
}
