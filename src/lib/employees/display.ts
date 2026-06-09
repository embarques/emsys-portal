import { getBranchBadgeClass, getBranchLabel } from "@/lib/trucks/display";
import type { Employee, EmployeePortalBranch } from "./types";
import {
  EMPLOYEE_ACTIVE_OPTIONS,
  formatEmployeeBranchLabel,
  formatEmployeePhones,
  formatEmployeeUserLabel,
  getEmployeePortalBranch,
} from "./types";

export function getEmployeeBranchLabel(branch: EmployeePortalBranch): string {
  return getBranchLabel(branch);
}

export function getEmployeeBranchBadgeClass(employee: Employee): string {
  return getBranchBadgeClass(getEmployeePortalBranch(employee));
}

export function getEmployeeActiveLabel(active: boolean): string {
  return EMPLOYEE_ACTIVE_OPTIONS.find((entry) => entry.value === active)?.label ?? (active ? "Active" : "Inactive");
}

export function getEmployeeActiveBadgeClass(active: boolean): string {
  return active
    ? "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
    : "border-transparent bg-muted text-muted-foreground";
}

export function formatEmployeeDate(date: string): string {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function formatEmployeeMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatEmployeeId(id: number): string {
  const value = String(id);
  return value.length > 12 ? `${value.slice(0, 8)}…` : value;
}

export function formatEmployeeAddress(employee: Employee): string {
  const parts = [
    employee.address.address1,
    employee.address.address2,
    employee.address.apartment,
    employee.address.city,
    employee.address.state,
    employee.address.zipcode,
    employee.address.country,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : "—";
}

export {
  formatEmployeeBranchLabel,
  formatEmployeePhones,
  formatEmployeeUserLabel,
} from "./types";

export function employeeMatchesQuery(employee: Employee, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  return [
    String(employee.id),
    employee.name,
    employee.department,
    employee.title,
    employee.startDate,
    employee.endDate,
    formatEmployeeBranchLabel(employee),
    employee.address.address1,
    employee.address.address2,
    employee.address.apartment,
    employee.address.city,
    employee.address.state,
    employee.address.zipcode,
    employee.address.country,
    formatEmployeePhones(employee),
    employee.email,
    getEmployeeActiveLabel(employee.active),
    formatEmployeeUserLabel(employee),
    formatEmployeeAddress(employee),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeEmployeeKpis(employees: Employee[]) {
  return {
    total: employees.length,
    active: employees.filter((employee) => employee.active).length,
    inactive: employees.filter((employee) => !employee.active).length,
    usa: employees.filter((employee) => getEmployeePortalBranch(employee) === "usa").length,
    dr: employees.filter((employee) => getEmployeePortalBranch(employee) === "dr").length,
  };
}
