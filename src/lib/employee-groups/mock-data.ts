import { getEmployeeById } from "@/lib/employees/mock-data";
import { getEmployeeFullName } from "@/lib/employees/types";
import type { EmployeeGroup, EmployeeGroupMember } from "./types";

function toMembers(employeeIds: string[]): EmployeeGroupMember[] {
  return employeeIds.flatMap((id) => {
    const employee = getEmployeeById(id);
    return employee ? [{ id, name: getEmployeeFullName(employee) }] : [];
  });
}

export const MOCK_EMPLOYEE_GROUPS: EmployeeGroup[] = [
  {
    employeeGroupId: "egr-001",
    employees: toMembers(["emp-001", "emp-003", "emp-005"]),
    branch: "usa",
    createdAt: "2026-01-10T09:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T14:22:00Z",
  },
  {
    employeeGroupId: "egr-002",
    employees: toMembers(["emp-002", "emp-007"]),
    branch: "dr",
    createdAt: "2026-02-14T11:30:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-03T11:05:00Z",
  },
  {
    employeeGroupId: "egr-003",
    employees: toMembers(["emp-004", "emp-008"]),
    branch: "dr",
    createdAt: "2026-03-05T15:45:00Z",
    createdBy: "Admin User",
    updatedAt: "2026-06-02T18:40:00Z",
  },
  {
    employeeGroupId: "egr-004",
    employees: toMembers(["emp-001", "emp-002", "emp-004", "emp-008"]),
    branch: "usa",
    createdAt: "2026-04-18T08:20:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-01T09:15:00Z",
  },
];

export function cloneEmployeeGroups(): EmployeeGroup[] {
  return MOCK_EMPLOYEE_GROUPS.map((group) => ({
    ...group,
    employees: group.employees.map((employee) => ({ ...employee })),
  }));
}

export function getEmployeeGroupById(employeeGroupId: string): EmployeeGroup | undefined {
  return MOCK_EMPLOYEE_GROUPS.find((group) => group.employeeGroupId === employeeGroupId);
}
