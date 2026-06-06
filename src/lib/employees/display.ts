import { getBranchBadgeClass, getBranchLabel } from "@/lib/trucks/display";
import type { Employee, EmployeeBranch, EmployeeStatus } from "./types";
import { EMPLOYEE_STATUSES } from "./types";

export function getEmployeeBranchLabel(branch: EmployeeBranch): string {
  return getBranchLabel(branch);
}

export function getEmployeeBranchBadgeClass(branch: EmployeeBranch): string {
  return getBranchBadgeClass(branch);
}

export function getEmployeeStatusLabel(status: EmployeeStatus): string {
  return EMPLOYEE_STATUSES.find((entry) => entry.value === status)?.label ?? status;
}

export function getEmployeeStatusBadgeClass(status: EmployeeStatus): string {
  return status === "active"
    ? "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : "border-transparent bg-muted text-muted-foreground";
}

export function formatEmployeeDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date.slice(0, 10)}T12:00:00`));
}

export function truncateEmployeeId(employeeId: string): string {
  return employeeId.length > 12 ? `${employeeId.slice(0, 8)}…` : employeeId;
}

export function formatEmployeeAddress(employee: Employee): string {
  const parts = [employee.address, employee.city, employee.state, employee.zip].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

export function employeeMatchesQuery(employee: Employee, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    employee.employeeId,
    employee.name,
    employee.department,
    employee.role,
    getEmployeeBranchLabel(employee.branch),
    employee.address,
    employee.city,
    employee.state,
    employee.zip,
    employee.phone,
    employee.email,
    formatEmployeeDate(employee.startDate),
    employee.endDate ? formatEmployeeDate(employee.endDate) : "",
    getEmployeeStatusLabel(employee.status),
    employee.createdBy,
    formatEmployeeAddress(employee),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeEmployeeKpis(employees: Employee[]) {
  return {
    total: employees.length,
    active: employees.filter((employee) => employee.status === "active").length,
    inactive: employees.filter((employee) => employee.status === "inactive").length,
    usa: employees.filter((employee) => employee.branch === "usa").length,
    dr: employees.filter((employee) => employee.branch === "dr").length,
  };
}
