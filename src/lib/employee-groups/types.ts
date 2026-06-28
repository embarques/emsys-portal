import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createRandomId } from "@/lib/utils/id";

export type EmployeeGroupBranch = "usa" | "dr";

export type EmployeeGroupMember = {
  id: string;
  name: string;
};

export type EmployeeGroup = {
  employeeGroupId: string;
  employees: EmployeeGroupMember[];
  branch: EmployeeGroupBranch;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type EmployeeGroupFormValues = {
  employeeGroupId: string;
  employees: EmployeeGroupMember[];
  branch: EmployeeGroupBranch;
  createdBy: string;
};

export type EmployeeGroupFilterState = {
  query: string;
  branch: EmployeeGroupBranch | "all";
};

export const EMPLOYEE_GROUP_BRANCHES: { value: EmployeeGroupBranch; label: string }[] = [
  { value: "usa", label: "USA" },
  { value: "dr", label: "DR" },
];

export function createEmployeeGroupId(): string {
  return createRandomId();
}

export function createEmptyEmployeeGroupForm(createdBy = DEFAULT_CREATED_BY): EmployeeGroupFormValues {
  return {
    employeeGroupId: createEmployeeGroupId(),
    employees: [],
    branch: "usa",
    createdBy,
  };
}

export function employeeGroupToFormValues(group: EmployeeGroup): EmployeeGroupFormValues {
  return {
    employeeGroupId: group.employeeGroupId,
    employees: group.employees.map((employee) => ({ ...employee })),
    branch: group.branch,
    createdBy: group.createdBy,
  };
}

export function formValuesToEmployeeGroup(
  values: EmployeeGroupFormValues,
  createdAt?: string,
  updatedAt?: string
): EmployeeGroup {
  if (values.employees.length === 0) {
    throw new Error("At least one employee is required.");
  }

  return {
    employeeGroupId: values.employeeGroupId,
    employees: values.employees,
    branch: values.branch,
    createdAt: createdAt ?? new Date().toISOString(),
    createdBy: values.createdBy.trim() || DEFAULT_CREATED_BY,
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
}
