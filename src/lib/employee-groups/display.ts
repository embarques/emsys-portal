import { getBranchBadgeClass, getBranchLabel } from "@/lib/vehicles/display";
import type { EmployeeGroup } from "./types";
import { EMPLOYEE_GROUP_BRANCHES } from "./types";

export function getEmployeeGroupBranchLabel(branch: string): string {
  return getBranchLabel(branch);
}

export function getEmployeeGroupBranchBadgeClass(branch: string): string {
  return getBranchBadgeClass(branch);
}

export function formatEmployeeGroupDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function truncateEmployeeGroupId(employeeGroupId: string): string {
  return employeeGroupId.length > 12 ? `${employeeGroupId.slice(0, 8)}…` : employeeGroupId;
}

export function formatEmployeeGroupMembersSummary(group: EmployeeGroup): string {
  return formatEmployeeMemberNames(group.employees);
}

/** Comma-separated employee names for any group-like object with named members. */
export function formatEmployeeMemberNames(employees: { name: string }[]): string {
  const names = employees.map((employee) => employee.name.trim()).filter(Boolean);
  return names.length > 0 ? names.join(", ") : "—";
}

export function employeeGroupMatchesQuery(group: EmployeeGroup, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const memberText = group.employees.map((employee) => employee.name).join(" ");

  return [
    group.employeeGroupId,
    group.createdBy,
    getEmployeeGroupBranchLabel(group.branch),
    memberText,
    formatEmployeeGroupDate(group.createdAt),
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

export function computeEmployeeGroupKpis(groups: EmployeeGroup[]) {
  return {
    total: groups.length,
    usa: groups.filter((group) => group.branch === "usa").length,
    dr: groups.filter((group) => group.branch === "dr").length,
  };
}

export { EMPLOYEE_GROUP_BRANCHES };
