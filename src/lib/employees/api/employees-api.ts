import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { buildApiListQuery, type ApiListFieldFilter } from "@/lib/api/list-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import {
  DEFAULT_EMPLOYEE_LIST_PARAMS,
  normalizeEmployeeSearchFilter,
  type Employee,
  type EmployeeAddress,
  type EmployeeBranch,
  type EmployeeFormValues,
  type EmployeeListParams,
} from "@/lib/employees/types";
import { normalizeApiUser } from "@/lib/users/api/users-api";
import { normalizeStoredPhone } from "@/lib/utils/phone";

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

type ApiBranch = {
  id?: number;
  code?: string;
  name?: string;
};

type ApiBranchWritePayload = {
  id: number;
  name: string;
  code: string;
};

type ApiEmployee = {
  id?: number | string;
  name?: string;
  title?: string;
  department?: string;
  active?: boolean;
  startDate?: string;
  endDate?: string;
  address?: ApiAddress;
  branch?: ApiBranch;
  cost?: number;
  loanAmountOwed?: number;
  loanBalanceUpdated?: string;
  phone1?: string[] | string | number;
  phone2?: string;
  email?: string;
  totalLoanGiven?: number;
  totalPaymentReceived?: number;
  user?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

type ApiEmployeeWritePayload = {
  active: boolean;
  address: ApiAddressWritePayload;
  branch: ApiBranchWritePayload;
  cost: number;
  createdAt: string;
  department: string;
  email: string;
  endDate: string;
  id: number;
  loanAmountOwed: number;
  loanBalanceUpdated: string;
  name: string;
  phone1: string;
  phone2: string;
  startDate: string;
  title: string;
  totalLoanGiven: number;
  totalPaymentReceived: number;
  updatedAt: string;
  user?: { id: number } | null;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

function readNumericId(value: number | string | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeBranch(raw?: ApiBranch): EmployeeBranch {
  const branch = raw ?? {};

  return {
    id: readNumericId(branch.id) ?? 0,
    name: String(branch.name ?? "").trim(),
    code: String(branch.code ?? "").trim(),
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
    const first = raw.map((entry) => String(entry).trim()).find(Boolean);
    return first ? normalizeStoredPhone(first) : "";
  }

  return normalizeStoredPhone(String(raw ?? ""));
}

function normalizeEmployee(raw: unknown): Employee | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiEmployee;
  const employeeId = readNumericId(item.id);
  if (employeeId == null) return null;

  const user = item.user != null ? normalizeApiUser(item.user) : null;

  return {
    id: employeeId,
    name: String(item.name ?? "").trim(),
    department: String(item.department ?? "").trim(),
    title: String(item.title ?? "").trim(),
    active: item.active !== false,
    startDate: item.startDate ?? "",
    endDate: item.endDate ?? "",
    branch: normalizeBranch(item.branch),
    address: normalizeAddress(item.address),
    phone1: normalizePhone1(item.phone1),
    phone2: normalizeStoredPhone(String(item.phone2 ?? "")),
    email: String(item.email ?? "").trim(),
    cost: Number(item.cost ?? 0),
    loanAmountOwed: Number(item.loanAmountOwed ?? 0),
    loanBalanceUpdated: item.loanBalanceUpdated ?? "",
    totalLoanGiven: Number(item.totalLoanGiven ?? 0),
    totalPaymentReceived: Number(item.totalPaymentReceived ?? 0),
    user,
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

function resolveEmployeeListFilter(params: EmployeeListParams): ApiListFieldFilter | undefined {
  if (params.search?.value.trim()) {
    const search = normalizeEmployeeSearchFilter({
      ...params.search,
      value: params.search.value.trim(),
    });

    return {
      field: search.field,
      operator: search.operator,
      value: search.value,
    };
  }

  if (params.department && params.department !== "all") {
    return { field: "department", operator: "eq", value: params.department };
  }

  if (params.active !== undefined && params.active !== "all") {
    return { field: "active", operator: "eq", value: String(params.active) };
  }

  if (params.branch && params.branch !== "all") {
    return { field: "branch.id", operator: "eq", value: String(params.branch) };
  }

  return undefined;
}

function buildEmployeesQuery(params: EmployeeListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_EMPLOYEE_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_EMPLOYEE_LIST_PARAMS.limit,
    sort: params.sort ?? DEFAULT_EMPLOYEE_LIST_PARAMS.sort,
    filter: resolveEmployeeListFilter(params),
  });
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
    id: branch.id,
    name: branch.name,
    code: branch.code,
  };
}

function buildEmployeeWritePayload(
  values: EmployeeFormValues,
  options: { id?: number; existing?: Employee } = {},
): ApiEmployeeWritePayload {
  const name = values.name.trim();
  const department = values.department.trim();
  const title = values.title.trim();

  if (!name) throw new Error("Employee name is required.");
  if (!department) throw new Error("Department is required.");
  if (!title) throw new Error("Title is required.");

  if (!values.branch.id) {
    throw new Error("Branch is required.");
  }

  const payload: ApiEmployeeWritePayload = {
    active: values.active,
    address: buildAddressWritePayload(values.address),
    branch: buildBranchWritePayload(values.branch),
    cost: Number(values.cost) || 0,
    createdAt: values.createdAt || options.existing?.createdAt || new Date().toISOString(),
    department,
    email: values.email.trim(),
    endDate: values.endDate,
    id: options.id ?? 0,
    loanAmountOwed: values.loanAmountOwed,
    loanBalanceUpdated: values.loanBalanceUpdated,
    name,
    phone1: normalizeStoredPhone(values.phone1),
    phone2: normalizeStoredPhone(values.phone2),
    startDate: values.startDate,
    title,
    totalLoanGiven: values.totalLoanGiven,
    totalPaymentReceived: values.totalPaymentReceived,
    updatedAt: values.updatedAt || new Date().toISOString(),
  };

  if (values.user?.id) {
    payload.user = { id: values.user.id };
  }

  return payload;
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
      search: { field: "name", operator: "eq", value: name },
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
