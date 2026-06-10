import type { ApiListSortInput } from "@/lib/api/list-query";
import type { User } from "@/lib/users/types";
import { formatPhoneForDisplay, normalizeStoredPhone } from "@/lib/utils/phone";

export type EmployeePortalBranch = "usa" | "dr";

export type EmployeeAddress = {
  address1: string;
  address2: string;
  apartment: string;
  city: string;
  country: string;
  state: string;
  zipcode: string;
};

export type EmployeeBranch = {
  id: number;
  name: string;
  code: string;
};

export type Employee = {
  id: number;
  name: string;
  title: string;
  department: string;
  phone1: string;
  phone2: string;
  email: string;
  active: boolean;
  startDate: string;
  endDate: string;
  createdAt: string;
  updatedAt: string;
  branch: EmployeeBranch;
  user: User | null;
  address: EmployeeAddress;
  totalLoanGiven: number;
  totalPaymentReceived: number;
  loanAmountOwed: number;
  loanBalanceUpdated: string;
  cost: number;
};

export type EmployeeFormValues = {
  id: number;
  name: string;
  title: string;
  department: string;
  phone1: string;
  phone2: string;
  email: string;
  active: boolean;
  startDate: string;
  endDate: string;
  branch: EmployeeBranch;
  address: EmployeeAddress;
  cost: number;
  loanAmountOwed: number;
  loanBalanceUpdated: string;
  totalLoanGiven: number;
  totalPaymentReceived: number;
  user: User | null;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeFilterState = {
  query: string;
  searchField: EmployeeSearchField;
  searchOperator: EmployeeSearchOperator;
  branch: number | "all";
  active: boolean | "all";
  department: string;
};

/** Matches GET /employees filter operators from the API spec. */
export type EmployeeSearchOperator = "eq" | "neq" | "contains" | "startsWith";

export type EmployeeSearchField =
  | "id"
  | "name"
  | "title"
  | "department"
  | "email"
  | "phone1"
  | "phone2"
  | "active"
  | "startDate"
  | "endDate"
  | "address.address1"
  | "address.address2"
  | "address.apartment"
  | "address.city"
  | "address.country"
  | "address.state"
  | "address.zipcode"
  | "branch.code"
  | "branch.id";

export type EmployeeSearchFilter = {
  field: EmployeeSearchField;
  operator: EmployeeSearchOperator;
  value: string;
};

export type EmployeeListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: EmployeeSearchFilter;
  branch?: number | "all";
  active?: boolean | "all";
  department?: string;
};

export type EmployeeListResult = {
  items: Employee[];
  page: number;
  resultsPerPage: number;
  total: number;
};

/** GET /employees?page=1&limit=40&offset=0&sort=name:asc */
export const DEFAULT_EMPLOYEE_LIST_PARAMS = {
  page: 1,
  limit: 40,
  sort: "name:asc",
} as const satisfies Pick<EmployeeListParams, "page" | "limit" | "sort">;

const BRANCH_ID_TO_PORTAL: Record<number, EmployeePortalBranch> = {
  1: "usa",
  2: "dr",
};

const BRANCH_CODE_TO_PORTAL: Record<string, EmployeePortalBranch> = {
  NY: "usa",
  DR: "dr",
  DO: "dr",
};

export const EMPLOYEE_PORTAL_BRANCHES: {
  portal: EmployeePortalBranch;
  id: number;
  label: string;
  code: string;
  name: string;
  country: string;
}[] = [
  { portal: "usa", id: 1, label: "USA", code: "NY", name: "New York", country: "US" },
  { portal: "dr", id: 2, label: "DR", code: "DR", name: "Dominican Republic", country: "DO" },
];

/** @deprecated Use EMPLOYEE_PORTAL_BRANCHES */
export const EMPLOYEE_BRANCHES = EMPLOYEE_PORTAL_BRANCHES.map((entry) => ({
  value: entry.portal,
  label: entry.label,
}));

/**
 * GET /employees field + operator pairs verified against the live API.
 * Nested address / branch.code / user filters may require POST /employees/search instead.
 */
export const EMPLOYEE_GET_SEARCH_CAPABILITIES: {
  field: EmployeeSearchField;
  label: string;
  operators: EmployeeSearchOperator[];
}[] = [
  { field: "name", label: "name", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "title", label: "title", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "department", label: "department", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "email", label: "email", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "phone1", label: "phone1", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "phone2", label: "phone2", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "active", label: "active", operators: ["eq", "neq"] },
  { field: "startDate", label: "startDate", operators: ["eq", "neq"] },
  { field: "endDate", label: "endDate", operators: ["eq", "neq"] },
  { field: "address.address1", label: "address.address1", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "address.address2", label: "address.address2", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "address.apartment", label: "address.apartment", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "address.city", label: "address.city", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "address.state", label: "address.state", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "address.country", label: "address.country", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "address.zipcode", label: "address.zipcode", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "branch.code", label: "branch.code", operators: ["startsWith", "contains", "eq", "neq"] },
  { field: "branch.id", label: "branch.id", operators: ["eq", "neq"] },
  { field: "id", label: "id", operators: ["eq", "neq"] },
];

export const EMPLOYEE_SEARCH_FIELDS: { value: EmployeeSearchField; label: string }[] =
  EMPLOYEE_GET_SEARCH_CAPABILITIES.map(({ field, label }) => ({ value: field, label }));

export const EMPLOYEE_SEARCH_OPERATORS: { value: EmployeeSearchOperator; label: string }[] = [
  { value: "startsWith", label: "Starts with" },
  { value: "contains", label: "Contains" },
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Not equals" },
];

export const EMPLOYEE_ACTIVE_OPTIONS: { value: boolean; label: string }[] = [
  { value: true, label: "Active" },
  { value: false, label: "Inactive" },
];

export const EMPLOYEE_DEPARTMENTS = [
  "Operations",
  "Warehouse",
  "Fleet",
  "Customer Service",
  "Administration",
  "Accounting",
  "driver",
] as const;

export const EMPLOYEE_TITLES = [
  "dispatcher",
  "warehouse",
  "driver",
  "support",
  "planner",
  "admin",
  "manager",
  "supervisor",
] as const;

/** @deprecated Use EMPLOYEE_TITLES */
export const EMPLOYEE_ROLES = EMPLOYEE_TITLES;

export function getEmployeeSearchOperatorsForField(field: EmployeeSearchField): EmployeeSearchOperator[] {
  return EMPLOYEE_GET_SEARCH_CAPABILITIES.find((entry) => entry.field === field)?.operators ?? ["eq"];
}

export function getDefaultEmployeeSearchOperator(field: EmployeeSearchField): EmployeeSearchOperator {
  return getEmployeeSearchOperatorsForField(field)[0];
}

export function normalizeEmployeeSearchFilter(search: EmployeeSearchFilter): EmployeeSearchFilter {
  const allowedOperators = getEmployeeSearchOperatorsForField(search.field);
  const operator = allowedOperators.includes(search.operator)
    ? search.operator
    : getDefaultEmployeeSearchOperator(search.field);

  return { field: search.field, operator, value: search.value };
}

export function createEmployeeSearchFilter(
  value: string,
  field: EmployeeSearchField = "name",
  operator: EmployeeSearchOperator = "startsWith",
): EmployeeSearchFilter | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  let normalizedValue = trimmed;
  if (field === "active") {
    const lower = trimmed.toLowerCase();
    if (["active", "true", "yes"].includes(lower)) normalizedValue = "true";
    if (["inactive", "false", "no"].includes(lower)) normalizedValue = "false";
  }

  return normalizeEmployeeSearchFilter({ field, operator, value: normalizedValue });
}

export function getEmployeeSearchSort(
  field: EmployeeSearchField,
  direction: "asc" | "desc" = "asc",
): string {
  switch (field) {
    case "title":
      return `title:${direction}`;
    case "department":
      return `department:${direction}`;
    case "email":
      return `email:${direction}`;
    case "phone1":
      return `phone1:${direction}`;
    case "phone2":
      return `phone2:${direction}`;
    case "active":
      return `active:${direction}`;
    case "startDate":
      return `startDate:${direction}`;
    case "endDate":
      return `endDate:${direction}`;
    case "id":
      return `id:${direction}`;
    case "branch.code":
      return `branch.code:${direction}`;
    case "branch.id":
      return `branch.id:${direction}`;
    default:
      return `name:${direction}`;
  }
}

export function createEmptyEmployeeAddress(country = ""): EmployeeAddress {
  return {
    address1: "",
    address2: "",
    apartment: "",
    city: "",
    country,
    state: "",
    zipcode: "",
  };
}

export function createEmployeeBranchFromPortal(portal: EmployeePortalBranch): EmployeeBranch {
  const config = EMPLOYEE_PORTAL_BRANCHES.find((entry) => entry.portal === portal) ?? EMPLOYEE_PORTAL_BRANCHES[0];

  return {
    id: config.id,
    name: config.name,
    code: config.code,
  };
}

export function getEmployeePortalBranch(employee: Pick<Employee, "branch" | "address">): EmployeePortalBranch {
  if (BRANCH_ID_TO_PORTAL[employee.branch.id]) {
    return BRANCH_ID_TO_PORTAL[employee.branch.id];
  }

  const code = employee.branch.code.trim().toUpperCase();
  if (code && BRANCH_CODE_TO_PORTAL[code]) {
    return BRANCH_CODE_TO_PORTAL[code];
  }

  const country = employee.address.country.trim().toUpperCase();
  if (country === "DO" || country === "DR") {
    return "dr";
  }

  return "usa";
}

export function portalBranchToId(portal: EmployeePortalBranch): number {
  return EMPLOYEE_PORTAL_BRANCHES.find((entry) => entry.portal === portal)?.id ?? 1;
}

export function createEmptyEmployeeForm(): EmployeeFormValues {
  const branch = createEmployeeBranchFromPortal("usa");

  return {
    id: 0,
    name: "",
    department: EMPLOYEE_DEPARTMENTS[0],
    title: EMPLOYEE_TITLES[0],
    active: true,
    startDate: "",
    endDate: "",
    branch,
    address: createEmptyEmployeeAddress("US"),
    phone1: "",
    phone2: "",
    email: "",
    cost: 0,
    loanAmountOwed: 0,
    loanBalanceUpdated: "",
    totalLoanGiven: 0,
    totalPaymentReceived: 0,
    user: null,
    createdAt: "",
    updatedAt: "",
  };
}

export function getEmployeeFullName(employee: Employee): string {
  return employee.name.trim();
}

export function getEmployeeLabel(employee: Employee): string {
  return `${employee.name} · ${employee.title}`;
}

export function formatEmployeeBranchLabel(employee: Employee): string {
  const portalBranch = getEmployeePortalBranch(employee);
  const branchLabel =
    EMPLOYEE_PORTAL_BRANCHES.find((entry) => entry.portal === portalBranch)?.label ?? portalBranch.toUpperCase();
  const details = [employee.branch.name, employee.branch.code].filter(Boolean).join(" · ");
  return details ? `${branchLabel} (${details})` : branchLabel;
}

export function formatEmployeePhones(employee: Employee): string {
  const phones = [employee.phone1, employee.phone2].map((value) => formatPhoneForDisplay(value)).filter(Boolean);
  return phones.length > 0 ? phones.join(", ") : "—";
}

export function formatEmployeeUserLabel(employee: Pick<Employee, "user">): string {
  if (!employee.user) return "—";
  return employee.user.userName || employee.user.fullName || String(employee.user.id);
}

export function employeeToFormValues(employee: Employee): EmployeeFormValues {
  return {
    id: employee.id,
    name: employee.name,
    department: employee.department,
    title: employee.title,
    active: employee.active,
    startDate: employee.startDate,
    endDate: employee.endDate,
    branch: { ...employee.branch },
    address: { ...employee.address },
    phone1: normalizeStoredPhone(employee.phone1),
    phone2: normalizeStoredPhone(employee.phone2),
    email: employee.email,
    cost: employee.cost,
    loanAmountOwed: employee.loanAmountOwed,
    loanBalanceUpdated: employee.loanBalanceUpdated,
    totalLoanGiven: employee.totalLoanGiven,
    totalPaymentReceived: employee.totalPaymentReceived,
    user: employee.user ? { ...employee.user } : null,
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}
