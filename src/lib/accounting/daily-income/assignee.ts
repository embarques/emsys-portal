import type { SearchableSelectOption } from "@/components/ui/searchable-select";
import type { EmployeeGroupOption } from "@/lib/employee-groups/api/employee-groups-api";
import { formatEmployeeMemberNames } from "@/lib/employee-groups/display";
import type { Employee } from "@/lib/employees/types";

const EMPLOYEE_PREFIX = "employee:";
const GROUP_PREFIX = "group:";

export function encodeTransactionAssigneeValue(
  type: "employee" | "group",
  id: string | number,
): string {
  return `${type === "employee" ? EMPLOYEE_PREFIX : GROUP_PREFIX}${id}`;
}

export function decodeTransactionAssigneeValue(
  value: string,
): { type: "employee" | "group"; id: string } | null {
  const trimmed = value.trim();
  if (trimmed.startsWith(EMPLOYEE_PREFIX)) {
    const id = trimmed.slice(EMPLOYEE_PREFIX.length);
    return id ? { type: "employee", id } : null;
  }
  if (trimmed.startsWith(GROUP_PREFIX)) {
    const id = trimmed.slice(GROUP_PREFIX.length);
    return id ? { type: "group", id } : null;
  }
  return null;
}

export function getTransactionAssigneeSelectValue(
  employeeId?: number,
  employeeGroupId?: string,
): string {
  if (employeeGroupId?.trim()) {
    return encodeTransactionAssigneeValue("group", employeeGroupId.trim());
  }
  if (employeeId) {
    return encodeTransactionAssigneeValue("employee", employeeId);
  }
  return "";
}

function formatEmployeeGroupLabel(group: EmployeeGroupOption): string {
  return group.name?.trim() || group.employeeGroupId;
}

export function buildTransactionAssigneeOptions(
  employees: Employee[],
  employeeGroups: EmployeeGroupOption[],
  options: { groupsOnly?: boolean } = {},
): SearchableSelectOption[] {
  const groupOptions = [...employeeGroups]
    .sort((left, right) => formatEmployeeGroupLabel(left).localeCompare(formatEmployeeGroupLabel(right)))
    .map((group) => {
      const memberNames = formatEmployeeMemberNames(group.employees);
      return {
        value: encodeTransactionAssigneeValue("group", group.id),
        label: formatEmployeeGroupLabel(group),
        description: "Employee group",
        keywords: [group.name, group.employeeGroupId, memberNames, "employee group", "group"],
      };
    });

  if (options.groupsOnly) {
    return groupOptions;
  }

  const employeeOptions = [...employees]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((employee) => ({
      value: encodeTransactionAssigneeValue("employee", employee.id),
      label: employee.name,
      description: "Employee",
      keywords: [employee.name, employee.department, employee.title, "employee"],
    }));

  return [...employeeOptions, ...groupOptions];
}

export function getTransactionAssigneeDisplayName(
  employeeName?: string,
  employeeGroupName?: string,
): string {
  return employeeName?.trim() || employeeGroupName?.trim() || "";
}
