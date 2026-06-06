import { getEmployeeById } from "@/lib/employees/mock-data";
import { getEmployeeFullName } from "@/lib/employees/types";
import { getBranchBadgeClass, getBranchLabel } from "@/lib/trucks/display";
import type { EmployeeGroup, EmployeeGroupBranch } from "./types";
import { EMPLOYEE_GROUP_BRANCHES } from "./types";

export function getEmployeeGroupBranchLabel(branch: EmployeeGroupBranch): string {
  return getBranchLabel(branch);
}

export function getEmployeeGroupBranchBadgeClass(branch: EmployeeGroupBranch): string {
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

export function formatEmployeeGroupMembersSummary(group: EmployeeGroup, limit = 3): string {
  const names = group.employeeIds
    .map((employeeId) => getEmployeeById(employeeId))
    .filter(Boolean)
    .map((employee) => getEmployeeFullName(employee!));

  if (names.length === 0) return "—";

  const visible = names.slice(0, limit);
  const suffix = names.length > limit ? ` (+${names.length - limit})` : "";
  return `${visible.join(", ")}${suffix}`;
}

export function employeeGroupMatchesQuery(group: EmployeeGroup, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;

  const memberText = group.employeeIds
    .map((employeeId) => getEmployeeById(employeeId))
    .filter(Boolean)
    .map((employee) => {
      const full = employee!;
      return `${getEmployeeFullName(full)} ${full.role} ${full.department}`;
    })
    .join(" ");

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
