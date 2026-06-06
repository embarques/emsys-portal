import type { EmployeeGroup } from "./types";

export const MOCK_EMPLOYEE_GROUPS: EmployeeGroup[] = [
  {
    employeeGroupId: "egr-001",
    employeeIds: ["emp-001", "emp-003", "emp-005"],
    branch: "usa",
    createdAt: "2026-01-10T09:00:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-04T14:22:00Z",
  },
  {
    employeeGroupId: "egr-002",
    employeeIds: ["emp-002", "emp-007"],
    branch: "dr",
    createdAt: "2026-02-14T11:30:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-03T11:05:00Z",
  },
  {
    employeeGroupId: "egr-003",
    employeeIds: ["emp-004", "emp-008"],
    branch: "dr",
    createdAt: "2026-03-05T15:45:00Z",
    createdBy: "Admin User",
    updatedAt: "2026-06-02T18:40:00Z",
  },
  {
    employeeGroupId: "egr-004",
    employeeIds: ["emp-001", "emp-002", "emp-004", "emp-008"],
    branch: "usa",
    createdAt: "2026-04-18T08:20:00Z",
    createdBy: "Hector Mejia",
    updatedAt: "2026-06-01T09:15:00Z",
  },
];

export function cloneEmployeeGroups(): EmployeeGroup[] {
  return MOCK_EMPLOYEE_GROUPS.map((group) => ({
    ...group,
    employeeIds: [...group.employeeIds],
  }));
}

export function getEmployeeGroupById(employeeGroupId: string): EmployeeGroup | undefined {
  return MOCK_EMPLOYEE_GROUPS.find((group) => group.employeeGroupId === employeeGroupId);
}
