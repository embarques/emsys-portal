import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";

export type EmployeeGroupBranch = "usa" | "dr";

export type EmployeeGroup = {
  employeeGroupId: string;
  employeeIds: string[];
  branch: EmployeeGroupBranch;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type EmployeeGroupFormValues = {
  employeeGroupId: string;
  employeeIds: string[];
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
  return crypto.randomUUID();
}

export function createEmptyEmployeeGroupForm(createdBy = DEFAULT_CREATED_BY): EmployeeGroupFormValues {
  return {
    employeeGroupId: createEmployeeGroupId(),
    employeeIds: [],
    branch: "usa",
    createdBy,
  };
}

export function employeeGroupToFormValues(group: EmployeeGroup): EmployeeGroupFormValues {
  return {
    employeeGroupId: group.employeeGroupId,
    employeeIds: [...group.employeeIds],
    branch: group.branch,
    createdBy: group.createdBy,
  };
}

export function formValuesToEmployeeGroup(
  values: EmployeeGroupFormValues,
  createdAt?: string,
  updatedAt?: string
): EmployeeGroup {
  if (values.employeeIds.length === 0) {
    throw new Error("At least one employee is required.");
  }

  return {
    employeeGroupId: values.employeeGroupId,
    employeeIds: values.employeeIds,
    branch: values.branch,
    createdAt: createdAt ?? new Date().toISOString(),
    createdBy: values.createdBy.trim() || DEFAULT_CREATED_BY,
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
}
