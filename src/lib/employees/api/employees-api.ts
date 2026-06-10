import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { buildApiListQuery, type ApiListFieldFilter } from "@/lib/api/list-query";
import {
  buildApiSearchBody,
  createTextSearchFilter,
  hasListTextSearch,
  resolveSearchField,
  resolveSearchOperator,
  type ApiSearchFilter,
} from "@/lib/api/search-query";
import {
  buildApiAddressPayload,
  buildApiBranchRef,
  type ApiAddressPayload,
  type ApiBranchRefPayload,
} from "@/lib/api/payloads";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import {
  DEFAULT_EMPLOYEE_LIST_PARAMS,
  type Employee,
  type EmployeeAddress,
  type EmployeeBranch,
  type EmployeeFormValues,
  type EmployeeListParams,
} from "@/lib/employees/types";
import { normalizeApiUser } from "@/lib/users/api/users-api";

const EMPLOYEE_LIST_SEARCH_FIELD = "name";
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

type ApiBranch = {
  id?: number;
  code?: string;
  name?: string;
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

/** POST/PUT /employees — see API_PAYLOADS.md */
type ApiEmployeeWritePayload = {
  name: string;
  title: string;
  department: string;
  phone1: string;
  active: boolean;
  branch: ApiBranchRefPayload;
  email?: string;
  phone2?: string;
  address?: ApiAddressPayload;
  cost?: number;
  startDate?: string;
  endDate?: string;
  loanAmountOwed?: number;
  loanBalanceUpdated?: string;
  totalLoanGiven?: number;
  totalPaymentReceived?: number;
  user?: { id: number };
  id?: number;
  createdAt?: string;
  updatedAt?: string;
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

function buildEmployeeSearchFilters(params: EmployeeListParams): ApiSearchFilter[] {
  const filters: ApiSearchFilter[] = [];

  if (params.search?.value.trim()) {
    const textFilter = createTextSearchFilter(
      resolveSearchField(params.search, EMPLOYEE_LIST_SEARCH_FIELD),
      params.search.value,
      resolveSearchOperator(params.search),
    );
    if (textFilter) {
      filters.push(textFilter);
    }
  }

  if (params.department && params.department !== "all") {
    filters.push({ field: "department", operator: "eq", value: params.department });
  }

  if (params.active !== undefined && params.active !== "all") {
    filters.push({ field: "active", operator: "eq", value: String(params.active) });
  }

  if (params.branch && params.branch !== "all") {
    filters.push({ field: "branch.id", operator: "eq", value: String(params.branch) });
  }

  return filters;
}

function resolveEmployeeListFilter(params: EmployeeListParams): ApiListFieldFilter | undefined {
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
    offset: params.offset,
    sort: params.sort ?? DEFAULT_EMPLOYEE_LIST_PARAMS.sort,
    filter: resolveEmployeeListFilter(params),
  });
}

function buildEmployeeWritePayload(
  values: EmployeeFormValues,
  options: { id?: number; existing?: Employee } = {},
): ApiEmployeeWritePayload {
  const name = values.name.trim();
  const department = values.department.trim();
  const title = values.title.trim();
  const email = values.email.trim();
  const phone1 = normalizeStoredPhone(values.phone1);
  const phone2 = normalizeStoredPhone(values.phone2);

  if (!name) throw new Error("Employee name is required.");
  if (!department) throw new Error("Department is required.");
  if (!title) throw new Error("Title is required.");

  if (!values.branch.id) {
    throw new Error("Branch is required.");
  }

  const payload: ApiEmployeeWritePayload = {
    name,
    title,
    department,
    phone1,
    active: values.active,
    branch: buildApiBranchRef(values.branch),
  };

  if (email) {
    payload.email = email;
  }

  if (phone2) {
    payload.phone2 = phone2;
  }

  const address = buildApiAddressPayload(values.address ?? {});
  if (address) {
    payload.address = address;
  }

  if (options.id != null) {
    payload.id = options.id;
  }

  if (Number.isFinite(values.cost) && values.cost !== 0) {
    payload.cost = values.cost;
  }

  if (values.startDate.trim()) {
    payload.startDate = values.startDate;
  }

  if (values.endDate.trim()) {
    payload.endDate = values.endDate;
  }

  if (values.loanAmountOwed !== 0) {
    payload.loanAmountOwed = values.loanAmountOwed;
  }

  if (values.loanBalanceUpdated.trim()) {
    payload.loanBalanceUpdated = values.loanBalanceUpdated;
  }

  if (values.totalLoanGiven !== 0) {
    payload.totalLoanGiven = values.totalLoanGiven;
  }

  if (values.totalPaymentReceived !== 0) {
    payload.totalPaymentReceived = values.totalPaymentReceived;
  }

  if (values.user?.id) {
    payload.user = { id: values.user.id };
  }

  if (options.id != null) {
    if (values.createdAt.trim() || options.existing?.createdAt) {
      payload.createdAt = values.createdAt || options.existing?.createdAt;
    }

    if (values.updatedAt.trim()) {
      payload.updatedAt = values.updatedAt;
    }
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

function buildEmployeeSearchBody(params: EmployeeListParams) {
  return buildApiSearchBody({
    page: params.page ?? DEFAULT_EMPLOYEE_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_EMPLOYEE_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_EMPLOYEE_LIST_PARAMS.sort,
    filters: buildEmployeeSearchFilters(params),
  });
}

export async function fetchEmployees(
  params: EmployeeListParams = {},
): Promise<PaginatedResult<Employee>> {
  if (hasListTextSearch(params.search)) {
    const response = await apiClient.post<PaginatedApiEnvelope<unknown[]>>(
      `${API_ENDPOINTS.EMPLOYEES}/search`,
      buildEmployeeSearchBody(params),
    );

    return normalizePaginatedEmployees(response);
  }

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
