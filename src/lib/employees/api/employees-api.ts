import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import {
  EMPLOYEE_PORTAL_BRANCHES,
  createEmptyEmployeeBranchSettings,
  type Employee,
  type EmployeeAddress,
  type EmployeeBranch,
  type EmployeeBranchSettings,
  type EmployeeFormValues,
  type EmployeeListParams,
  type EmployeePortalBranch,
  type EmployeeUser,
  portalBranchToId,
} from "@/lib/employees/types";

type ApiAddress = {
  address1?: string;
  address2?: string;
  apartment?: string;
  city?: string;
  country?: string;
  state?: string;
  zipcode?: string;
};

type ApiAddressWritePayload = {
  address1: string;
  address2: string;
  apartment: string;
  city: string;
  country: string;
  state: string;
  zipcode: string;
};

type ApiBranchSettings = {
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

type ApiBranchWritePayload = {
  address: ApiAddressWritePayload;
  code: string;
  created: string;
  disclaimer: string;
  id: number;
  logo: string;
  name: string;
  phone1: string;
  phone2: string;
  settings: ApiBranchSettings;
  type: string;
};

type ApiPermissionWritePayload = {
  create: boolean;
  delete: boolean;
  id: number;
  name: string;
  print: boolean;
  resourceType: string;
  update: boolean;
  view: boolean;
};

type ApiRoleWritePayload = {
  active: boolean;
  createdAt: string;
  id: number;
  name: string;
  permissions: ApiPermissionWritePayload[];
  updatedAt: string;
};

type ApiUserWritePayload = {
  accessCode: number;
  active: boolean;
  branch: ApiBranchWritePayload;
  branches: ApiBranchWritePayload[];
  createdAt: string;
  email: string;
  endTime: string;
  fullName: string;
  id: number;
  password: string;
  role: ApiRoleWritePayload;
  startTime: string;
  type: string;
  uid: string;
  updatedAt: string;
  user: string;
  userName: string;
};

type ApiBranch = {
  id?: number;
  code?: string;
  name?: string;
  address?: ApiAddress;
  created?: string;
  disclaimer?: string;
  logo?: string;
  phone1?: string;
  phone2?: string;
  settings?: Partial<ApiBranchSettings>;
  type?: string;
};

type ApiUserRef = {
  id?: number;
  userName?: string;
  email?: string;
  fullName?: string;
  active?: boolean;
};

type ApiEmployee = {
  id?: number | string;
  name?: string;
  title?: string;
  department?: string;
  active?: boolean;
  address?: ApiAddress;
  branch?: ApiBranch;
  branchs?: ApiBranch[];
  cost?: number;
  loanAmountOwed?: number;
  loanBalanceUpdated?: string;
  phone1?: string[] | string | number;
  phone2?: string;
  email?: string;
  totalLoanGiven?: number;
  totalPaymentReceived?: number;
  user?: ApiUserRef;
  users?: ApiUserRef[];
  createdAt?: string;
  updatedAt?: string;
};

type ApiEmployeeWritePayload = {
  active: boolean;
  address: ApiAddressWritePayload;
  branch: ApiBranchWritePayload;
  branchs: ApiBranchWritePayload[];
  cost: number;
  createdAt: string;
  department: string;
  email: string;
  id: number;
  loanAmountOwed: number;
  loanBalanceUpdated: string;
  name: string;
  phone1: string;
  phone2: string;
  title: string;
  totalLoanGiven: number;
  totalPaymentReceived: number;
  updatedAt: string;
  user: ApiUserWritePayload;
  users: ApiUserWritePayload[];
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

function buildDefaultBranchSettings(): ApiBranchSettings {
  return createEmptyEmployeeBranchSettings();
}

function buildAddressWritePayload(address?: Partial<EmployeeAddress>): ApiAddressWritePayload {
  return {
    address1: address?.address1?.trim() ?? "",
    address2: address?.address2?.trim() ?? "",
    apartment: address?.apartment?.trim() ?? "",
    city: address?.city?.trim() ?? "",
    country: address?.country?.trim() ?? "",
    state: address?.state?.trim() ?? "",
    zipcode: address?.zipcode?.trim() ?? "",
  };
}

function buildBranchWritePayload(branch: EmployeeBranch): ApiBranchWritePayload {
  return {
    address: buildAddressWritePayload(branch.address),
    code: branch.code,
    created: branch.created,
    disclaimer: branch.disclaimer,
    id: branch.id,
    logo: branch.logo,
    name: branch.name,
    phone1: branch.phone1,
    phone2: branch.phone2,
    settings: branch.settings,
    type: branch.type,
  };
}

function buildDefaultRolePayload(): ApiRoleWritePayload {
  return {
    active: true,
    createdAt: "",
    id: 0,
    name: "",
    permissions: [],
    updatedAt: "",
  };
}

function buildUserWritePayload(
  branch: EmployeeBranch,
  overrides: { id?: number; userName?: string } = {},
): ApiUserWritePayload {
  const branchPayload = buildBranchWritePayload(branch);
  const userName = overrides.userName?.trim() ?? "";

  return {
    accessCode: 0,
    active: true,
    branch: branchPayload,
    branches: [branchPayload],
    createdAt: "",
    email: "",
    endTime: "",
    fullName: "",
    id: overrides.id ?? 0,
    password: "",
    role: buildDefaultRolePayload(),
    startTime: "",
    type: "",
    uid: "",
    updatedAt: "",
    user: userName,
    userName,
  };
}

function readNumericId(value: number | string | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeBranchSettings(raw?: Partial<ApiBranchSettings>): EmployeeBranchSettings {
  const settings = raw ?? {};

  return {
    defaultLabelStatus: Number(settings.defaultLabelStatus ?? 0),
    imageResampleBy: Number(settings.imageResampleBy ?? 0),
    invoiceCreatedThruIncomeStatement: settings.invoiceCreatedThruIncomeStatement === true,
    labelPrefix: String(settings.labelPrefix ?? "").trim(),
    printLabelCount: settings.printLabelCount === true,
    roundDecimalPlaces: Number(settings.roundDecimalPlaces ?? 0),
    s3BucketFolder: String(settings.s3BucketFolder ?? "").trim(),
    s3BucketName: String(settings.s3BucketName ?? "").trim(),
    s3Profile: String(settings.s3Profile ?? "").trim(),
    s3ShareLinkExpireMinutes: Number(settings.s3ShareLinkExpireMinutes ?? 0),
  };
}

function normalizeBranch(raw?: ApiBranch, fallbackCountry?: string): EmployeeBranch {
  const branch = raw ?? {};
  const id = readNumericId(branch.id) ?? 1;
  const defaults = EMPLOYEE_PORTAL_BRANCHES.find((entry) => entry.id === id) ?? EMPLOYEE_PORTAL_BRANCHES[0];

  return {
    address: normalizeAddress(branch.address ?? { country: fallbackCountry ?? defaults.country }),
    code: String(branch.code ?? defaults.code).trim(),
    created: String(branch.created ?? "").trim(),
    disclaimer: String(branch.disclaimer ?? "").trim(),
    id,
    logo: String(branch.logo ?? "").trim(),
    name: String(branch.name ?? defaults.name).trim(),
    phone1: String(branch.phone1 ?? "").trim(),
    phone2: String(branch.phone2 ?? "").trim(),
    settings: normalizeBranchSettings(branch.settings),
    type: String(branch.type ?? "").trim(),
  };
}

function normalizeUser(raw?: ApiUserRef): EmployeeUser | null {
  const id = readNumericId(raw?.id);
  if (id == null) return null;

  return {
    id,
    userName: String(raw?.userName ?? "").trim(),
    email: String(raw?.email ?? "").trim(),
    fullName: String(raw?.fullName ?? "").trim(),
    active: raw?.active !== false,
  };
}

function normalizeAddress(raw: ApiAddress | undefined): EmployeeAddress {
  const address = raw ?? {};

  return {
    address1: String(address.address1 ?? "").trim(),
    address2: String(address.address2 ?? "").trim(),
    apartment: String(address.apartment ?? "").trim(),
    city: String(address.city ?? "").trim(),
    country: String(address.country ?? "").trim(),
    state: String(address.state ?? "").trim(),
    zipcode: String(address.zipcode ?? "").trim(),
  };
}

function normalizePhone1(raw: ApiEmployee["phone1"]): string {
  if (Array.isArray(raw)) {
    return raw
      .map((entry) => String(entry).trim())
      .filter(Boolean)
      .join(", ");
  }

  return String(raw ?? "").trim();
}

function normalizeEmployee(raw: unknown): Employee | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiEmployee;
  const employeeId = readNumericId(item.id);
  if (employeeId == null) return null;

  const address = normalizeAddress(item.address);
  const branch = normalizeBranch(item.branch, address.country);
  const branchs = Array.isArray(item.branchs)
    ? item.branchs.map((entry) => normalizeBranch(entry))
    : [];
  const user = normalizeUser(item.user);
  const users = Array.isArray(item.users)
    ? item.users.map((entry) => normalizeUser(entry)).filter((entry): entry is EmployeeUser => entry != null)
    : [];

  return {
    id: employeeId,
    name: String(item.name ?? "").trim(),
    department: String(item.department ?? "").trim(),
    title: String(item.title ?? "").trim(),
    active: item.active !== false,
    branch,
    branchs,
    address,
    phone1: normalizePhone1(item.phone1),
    phone2: String(item.phone2 ?? "").trim(),
    email: String(item.email ?? "").trim(),
    cost: Number(item.cost ?? 0),
    loanAmountOwed: Number(item.loanAmountOwed ?? 0),
    loanBalanceUpdated: item.loanBalanceUpdated ?? "",
    totalLoanGiven: Number(item.totalLoanGiven ?? 0),
    totalPaymentReceived: Number(item.totalPaymentReceived ?? 0),
    user,
    users,
    createdAt: item.createdAt ?? "",
    updatedAt: item.updatedAt ?? "",
  };
}

function normalizePaginatedEmployees(
  payload: PaginatedApiEnvelope<unknown[]>,
): PaginatedResult<Employee> {
  const items = Array.isArray(payload.data)
    ? payload.data
        .map(normalizeEmployee)
        .filter((employee): employee is Employee => employee != null)
    : [];

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: payload.total ?? items.length,
  };
}

function buildEmployeesQuery(params: EmployeeListParams): string {
  const page = params.page ?? 1;
  const limit = params.limit ?? 40;
  const searchParams = new URLSearchParams({
    page: String(page),
    start: String((page - 1) * limit),
    limit: String(limit),
    sortField: params.sortField ?? "name",
    sortDirection: params.sortDirection ?? "asc",
  });

  if (params.search?.value.trim()) {
    searchParams.set("field", params.search.field);
    searchParams.set("operator", params.search.operator);
    searchParams.set("value", params.search.value.trim());
  }

  if (params.department && params.department !== "all") {
    searchParams.set("department", params.department);
  }

  if (params.active !== undefined && params.active !== "all") {
    searchParams.set("active", String(params.active));
  }

  if (params.branch && params.branch !== "all") {
    searchParams.set("branchId", String(portalBranchToId(params.branch as EmployeePortalBranch)));
  }

  return searchParams.toString();
}

function buildEmployeeWritePayload(
  values: EmployeeFormValues,
  options: { id?: number; existing?: Employee } = {},
): ApiEmployeeWritePayload {
  const name = values.name.trim();
  const department = values.department.trim();
  const title = values.title.trim();
  const branchPayload = buildBranchWritePayload(values.branch);

  if (!name) throw new Error("Employee name is required.");
  if (!department) throw new Error("Department is required.");
  if (!title) throw new Error("Title is required.");

  const primaryUser =
    values.user != null
      ? buildUserWritePayload(values.branch, {
          id: values.user.id,
          userName: values.user.userName,
        })
      : buildUserWritePayload(values.branch);

  const linkedUsers = values.users.map((linkedUser) =>
    buildUserWritePayload(values.branch, {
      id: linkedUser.id,
      userName: linkedUser.userName,
    }),
  );

  const branchsPayload =
    values.branchs.length > 0
      ? values.branchs.map((branch) => buildBranchWritePayload(branch))
      : [branchPayload];

  return {
    active: values.active,
    address: buildAddressWritePayload(values.address),
    branch: branchPayload,
    branchs: branchsPayload,
    cost: Number(values.cost) || 0,
    createdAt: values.createdAt,
    department,
    email: values.email.trim(),
    id: options.id ?? 0,
    loanAmountOwed: values.loanAmountOwed,
    loanBalanceUpdated: values.loanBalanceUpdated,
    name,
    phone1: values.phone1.trim(),
    phone2: values.phone2.trim(),
    title,
    totalLoanGiven: values.totalLoanGiven,
    totalPaymentReceived: values.totalPaymentReceived,
    updatedAt: values.updatedAt,
    user: primaryUser,
    users: linkedUsers,
  };
}

function parseEmployeePathId(employeeId: string): number {
  const numericId = readNumericId(employeeId);
  if (numericId == null) {
    throw new Error("Invalid employee ID.");
  }

  return numericId;
}

function assertMutationSuccess(response: ApiMutationEnvelope<unknown>, fallbackMessage: string) {
  if (response.success === false) {
    throw new Error(response.message?.trim() || response.error?.trim() || fallbackMessage);
  }
}

function extractEmployeeFromMutationResponse(data: unknown): Employee | null {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return normalizeEmployee(data);
  }

  return null;
}

function extractCreatedEmployeeId(response: ApiMutationEnvelope<unknown>): string | null {
  const data = response.data;

  if (typeof data === "string" || typeof data === "number") {
    const id = String(data).trim();
    return id || null;
  }

  const employee = extractEmployeeFromMutationResponse(data);
  return employee?.id != null ? String(employee.id) : null;
}

async function resolveCreatedEmployee(
  values: EmployeeFormValues,
  response: ApiMutationEnvelope<unknown>,
): Promise<Employee> {
  const createdId = extractCreatedEmployeeId(response);
  if (createdId) {
    return fetchEmployeeById(createdId);
  }

  const employee = extractEmployeeFromMutationResponse(response.data);
  if (employee) {
    return employee;
  }

  const name = values.name.trim();
  if (name) {
    const matches = await fetchEmployees({
      page: 1,
      limit: 1,
      search: { field: "name", operator: "equals", value: name },
    });

    const matchedEmployee = matches.items[0];
    if (matchedEmployee) {
      return matchedEmployee;
    }
  }

  const message = response.message || response.error;
  throw new Error(message?.trim() || "Unable to create employee.");
}

export async function fetchEmployees(
  params: EmployeeListParams = {},
): Promise<PaginatedResult<Employee>> {
  const query = buildEmployeesQuery(params);
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.EMPLOYEES}?${query}`,
  );

  return normalizePaginatedEmployees(response);
}

export async function fetchEmployeeById(employeeId: string): Promise<Employee> {
  const numericId = parseEmployeePathId(employeeId);
  const response = await apiClient.get<ApiEmployee | PaginatedApiEnvelope<ApiEmployee>>(
    `${API_ENDPOINTS.EMPLOYEES}/${numericId}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiEmployee>).data
      : response;

  const employee = normalizeEmployee(raw);
  if (!employee) {
    throw new Error("Employee not found.");
  }

  return employee;
}

export async function createEmployee(values: EmployeeFormValues): Promise<Employee> {
  const response = await apiClient.post<ApiMutationEnvelope<unknown>>(
    API_ENDPOINTS.EMPLOYEES,
    buildEmployeeWritePayload(values),
  );

  assertMutationSuccess(response, "Unable to create employee.");

  return resolveCreatedEmployee(values, response);
}

export async function updateEmployee(
  employeeId: string,
  values: EmployeeFormValues,
): Promise<Employee> {
  const numericId = parseEmployeePathId(employeeId);
  const existing = await fetchEmployeeById(employeeId);
  const response = await apiClient.put<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.EMPLOYEES}/${numericId}`,
    buildEmployeeWritePayload(values, { id: numericId, existing }),
  );

  assertMutationSuccess(response, "Unable to update employee.");

  const updatedEmployee = extractEmployeeFromMutationResponse(response.data);
  if (updatedEmployee) {
    return updatedEmployee;
  }

  return fetchEmployeeById(String(numericId));
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  const numericId = parseEmployeePathId(employeeId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.EMPLOYEES}/${numericId}`,
  );

  assertMutationSuccess(response, "Unable to delete employee.");
}

export async function deleteEmployees(employeeIds: string[]): Promise<void> {
  await Promise.all(employeeIds.map((employeeId) => deleteEmployee(employeeId)));
}
