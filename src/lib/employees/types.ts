import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createRecordId } from "@/lib/customers/types";

export type EmployeeBranch = "usa" | "dr";
export type EmployeeStatus = "active" | "inactive";

export type Employee = {
  employeeId: string;
  name: string;
  department: string;
  role: string;
  branch: EmployeeBranch;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  startDate: string;
  endDate?: string;
  status: EmployeeStatus;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type EmployeeFormValues = {
  employeeId: string;
  name: string;
  department: string;
  role: string;
  branch: EmployeeBranch;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string;
  startDate: string;
  endDate: string;
  status: EmployeeStatus;
  createdBy: string;
};

export type EmployeeFilterState = {
  query: string;
  searchField: EmployeeSearchField;
  searchOperator: EmployeeSearchOperator;
  branch: EmployeeBranch | "all";
  status: EmployeeStatus | "all";
  department: string;
};

export type EmployeeSearchOperator = "startsWith" | "contains" | "equals" | "endsWith";

export type EmployeeSearchField =
  | "name"
  | "title"
  | "department"
  | "phone"
  | "email"
  | "address.city"
  | "address.country"
  | "active";

export type EmployeeSearchFilter = {
  field: EmployeeSearchField;
  operator: EmployeeSearchOperator;
  value: string;
};

export type EmployeeListParams = {
  page?: number;
  limit?: number;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  search?: EmployeeSearchFilter;
  branch?: EmployeeBranch | "all";
  status?: EmployeeStatus | "all";
  department?: string;
};

export type EmployeeListResult = {
  items: Employee[];
  page: number;
  resultsPerPage: number;
  total: number;
};

export const EMPLOYEE_SEARCH_FIELDS: { value: EmployeeSearchField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "title", label: "Role" },
  { value: "department", label: "Department" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "address.city", label: "City" },
  { value: "address.country", label: "Country" },
  { value: "active", label: "Active" },
];

export const EMPLOYEE_SEARCH_OPERATORS: { value: EmployeeSearchOperator; label: string }[] = [
  { value: "startsWith", label: "Starts with" },
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "endsWith", label: "Ends with" },
];

export function createEmployeeSearchFilter(
  value: string,
  field: EmployeeSearchField = "name",
  operator: EmployeeSearchOperator = "startsWith",
): EmployeeSearchFilter | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  return { field, operator, value: trimmed };
}

export const EMPLOYEE_BRANCHES: { value: EmployeeBranch; label: string }[] = [
  { value: "usa", label: "USA" },
  { value: "dr", label: "DR" },
];

export const EMPLOYEE_STATUSES: { value: EmployeeStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

export const EMPLOYEE_DEPARTMENTS = [
  "Operations",
  "Warehouse",
  "Fleet",
  "Customer Service",
  "Administration",
  "Accounting",
] as const;

export const EMPLOYEE_ROLES = [
  "dispatcher",
  "warehouse",
  "driver",
  "support",
  "planner",
  "admin",
  "manager",
  "supervisor",
] as const;

export function createEmployeeId(): string {
  return createRecordId();
}

export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function createEmptyEmployeeForm(createdBy = DEFAULT_CREATED_BY): EmployeeFormValues {
  return {
    employeeId: "",
    name: "",
    department: EMPLOYEE_DEPARTMENTS[0],
    role: EMPLOYEE_ROLES[0],
    branch: "usa",
    address: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
    email: "",
    startDate: todayDateInputValue(),
    endDate: "",
    status: "active",
    createdBy,
  };
}

export function getEmployeeFullName(employee: Employee): string {
  return employee.name.trim();
}

export function getEmployeeLabel(employee: Employee): string {
  return `${employee.name} · ${employee.role}`;
}

export function employeeToFormValues(employee: Employee): EmployeeFormValues {
  return {
    employeeId: employee.employeeId,
    name: employee.name,
    department: employee.department,
    role: employee.role,
    branch: employee.branch,
    address: employee.address,
    city: employee.city,
    state: employee.state,
    zip: employee.zip,
    phone: employee.phone,
    email: employee.email,
    startDate: employee.startDate.slice(0, 10),
    endDate: employee.endDate?.slice(0, 10) ?? "",
    status: employee.status,
    createdBy: employee.createdBy,
  };
}

export function formValuesToEmployee(
  values: EmployeeFormValues,
  createdAt?: string,
  createdBy?: string,
  updatedAt?: string
): Employee {
  if (!values.name.trim()) {
    throw new Error("Employee name is required.");
  }

  if (!values.department.trim()) {
    throw new Error("Department is required.");
  }

  if (!values.role.trim()) {
    throw new Error("Role is required.");
  }

  if (!values.startDate) {
    throw new Error("Start date is required.");
  }

  if (values.status === "inactive" && !values.endDate.trim()) {
    throw new Error("End date is required for inactive employees.");
  }

  return {
    employeeId: values.employeeId,
    name: values.name.trim(),
    department: values.department.trim(),
    role: values.role.trim(),
    branch: values.branch,
    address: values.address.trim(),
    city: values.city.trim(),
    state: values.state.trim(),
    zip: values.zip.trim(),
    phone: values.phone.trim(),
    email: values.email.trim(),
    startDate: values.startDate,
    endDate: values.endDate.trim() || undefined,
    status: values.status,
    createdAt: createdAt ?? new Date().toISOString(),
    createdBy: createdBy ?? (values.createdBy.trim() || DEFAULT_CREATED_BY),
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
}
