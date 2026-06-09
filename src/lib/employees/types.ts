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

export type EmployeeBranchSettings = {
  defaultLabelStatus: number;
  imageResampleBy: number;
  invoiceCreatedThruIncomeStatement: boolean;
  labelPrefix: string;
  printLabelCount: boolean;
  roundDecimalPlaces: number;
  s3BucketFolder: string;
  s3BucketName: string;
  s3Profile: string;
  s3ShareLinkExpireMinutes: number;
};

export type EmployeeBranch = {
  address: EmployeeAddress;
  code: string;
  created: string;
  disclaimer: string;
  id: number;
  logo: string;
  name: string;
  phone1: string;
  phone2: string;
  settings: EmployeeBranchSettings;
  type: string;
};

export type EmployeeUser = {
  id: number;
  userName: string;
  email: string;
  fullName: string;
  active: boolean;
};

export type Employee = {
  id: number;
  name: string;
  department: string;
  title: string;
  active: boolean;
  branch: EmployeeBranch;
  branchs: EmployeeBranch[];
  address: EmployeeAddress;
  phone1: string;
  phone2: string;
  email: string;
  cost: number;
  loanAmountOwed: number;
  loanBalanceUpdated: string;
  totalLoanGiven: number;
  totalPaymentReceived: number;
  user: EmployeeUser | null;
  users: EmployeeUser[];
  createdAt: string;
  updatedAt: string;
};

export type EmployeeFormValues = {
  id: number;
  name: string;
  department: string;
  title: string;
  active: boolean;
  branch: EmployeeBranch;
  branchs: EmployeeBranch[];
  address: EmployeeAddress;
  phone1: string;
  phone2: string;
  email: string;
  cost: number;
  loanAmountOwed: number;
  loanBalanceUpdated: string;
  totalLoanGiven: number;
  totalPaymentReceived: number;
  user: EmployeeUser | null;
  users: EmployeeUser[];
  createdAt: string;
  updatedAt: string;
};

export type EmployeeFilterState = {
  query: string;
  searchField: EmployeeSearchField;
  searchOperator: EmployeeSearchOperator;
  branch: EmployeePortalBranch | "all";
  active: boolean | "all";
  department: string;
};

export type EmployeeSearchOperator = "startsWith" | "contains" | "equals" | "endsWith";

export type EmployeeSearchField =
  | "id"
  | "name"
  | "title"
  | "department"
  | "email"
  | "phone2"
  | "active"
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
  sortField?: string;
  sortDirection?: "asc" | "desc";
  search?: EmployeeSearchFilter;
  branch?: EmployeePortalBranch | "all";
  active?: boolean | "all";
  department?: string;
};

export type EmployeeListResult = {
  items: Employee[];
  page: number;
  resultsPerPage: number;
  total: number;
};

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

export const EMPLOYEE_SEARCH_FIELDS: { value: EmployeeSearchField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "title", label: "Title" },
  { value: "department", label: "Department" },
  { value: "email", label: "Email" },
  { value: "phone2", label: "Phone 2" },
  { value: "active", label: "Active" },
  { value: "address.address1", label: "Address 1" },
  { value: "address.address2", label: "Address 2" },
  { value: "address.apartment", label: "Apartment" },
  { value: "address.city", label: "City" },
  { value: "address.state", label: "State" },
  { value: "address.country", label: "Country" },
  { value: "address.zipcode", label: "Zipcode" },
  { value: "branch.code", label: "Branch code" },
  { value: "branch.id", label: "Branch ID" },
  { value: "id", label: "ID" },
];

export const EMPLOYEE_SEARCH_OPERATORS: { value: EmployeeSearchOperator; label: string }[] = [
  { value: "startsWith", label: "Starts with" },
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "endsWith", label: "Ends with" },
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

  return { field, operator, value: normalizedValue };
}

export function getEmployeeSearchSortField(field: EmployeeSearchField): string {
  switch (field) {
    case "title":
      return "title";
    case "department":
      return "department";
    case "email":
      return "email";
    case "phone2":
      return "phone2";
    case "active":
      return "active";
    case "id":
      return "id";
    case "branch.code":
      return "branch.code";
    case "branch.id":
      return "branch.id";
    default:
      return field;
  }
}

export function createEmptyEmployeeBranchSettings(): EmployeeBranchSettings {
  return {
    defaultLabelStatus: 0,
    imageResampleBy: 0,
    invoiceCreatedThruIncomeStatement: false,
    labelPrefix: "",
    printLabelCount: false,
    roundDecimalPlaces: 0,
    s3BucketFolder: "",
    s3BucketName: "",
    s3Profile: "",
    s3ShareLinkExpireMinutes: 0,
  };
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
    address: createEmptyEmployeeAddress(config.country),
    code: config.code,
    created: "",
    disclaimer: "",
    id: config.id,
    logo: "",
    name: config.name,
    phone1: "",
    phone2: "",
    settings: createEmptyEmployeeBranchSettings(),
    type: "",
  };
}

export function getEmployeePortalBranch(employee: Pick<Employee, "branch" | "address">): EmployeePortalBranch {
  const branchId = employee.branch.id;
  if (BRANCH_ID_TO_PORTAL[branchId]) {
    return BRANCH_ID_TO_PORTAL[branchId];
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
    branch,
    branchs: [branch],
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
    users: [],
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
  const phones = [employee.phone1, employee.phone2].map((value) => value.trim()).filter(Boolean);
  return phones.length > 0 ? phones.join(", ") : "—";
}

export function formatEmployeeBranchs(employee: Pick<Employee, "branchs">): string {
  const labels = employee.branchs
    .map((branch) => [branch.code, branch.name].filter(Boolean).join(" · "))
    .filter(Boolean);

  return labels.length > 0 ? labels.join(", ") : "—";
}

export function formatEmployeeUsers(employee: Pick<Employee, "users">): string {
  const labels = employee.users.map((user) => user.userName || String(user.id)).filter(Boolean);
  return labels.length > 0 ? labels.join(", ") : "—";
}

export function employeeToFormValues(employee: Employee): EmployeeFormValues {
  return {
    id: employee.id,
    name: employee.name,
    department: employee.department,
    title: employee.title,
    active: employee.active,
    branch: employee.branch,
    branchs: employee.branchs.length > 0 ? employee.branchs.map((branch) => ({ ...branch })) : [{ ...employee.branch }],
    address: { ...employee.address },
    phone1: employee.phone1,
    phone2: employee.phone2,
    email: employee.email,
    cost: employee.cost,
    loanAmountOwed: employee.loanAmountOwed,
    loanBalanceUpdated: employee.loanBalanceUpdated,
    totalLoanGiven: employee.totalLoanGiven,
    totalPaymentReceived: employee.totalPaymentReceived,
    user: employee.user ? { ...employee.user } : null,
    users: employee.users.map((user) => ({ ...user })),
    createdAt: employee.createdAt,
    updatedAt: employee.updatedAt,
  };
}
