import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import type {
  Employee,
  EmployeeBranch,
  EmployeeFormValues,
  EmployeeListParams,
  EmployeeStatus,
} from "@/lib/employees/types";

type ApiEmployeeAddress = {
  city?: string;
  country?: string;
  state?: string;
  zip?: string;
  street?: string;
  line1?: string;
};

type ApiEmployeeBranch = {
  id?: number;
};

type ApiEmployee = {
  id?: number | string;
  name?: string;
  title?: string;
  department?: string;
  active?: boolean;
  branch?: ApiEmployeeBranch;
  address?: ApiEmployeeAddress;
  phone?: string;
  email?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
};

const BRANCH_ID_TO_PORTAL: Record<number, EmployeeBranch> = {
  1: "usa",
  2: "dr",
};

const PORTAL_BRANCH_TO_ID: Record<EmployeeBranch, number> = {
  usa: 1,
  dr: 2,
};

function branchIdToPortal(branchId: number | undefined, country?: string): EmployeeBranch {
  if (branchId != null && BRANCH_ID_TO_PORTAL[branchId]) {
    return BRANCH_ID_TO_PORTAL[branchId];
  }

  const normalizedCountry = country?.trim().toUpperCase();
  if (normalizedCountry === "DO" || normalizedCountry === "DR") {
    return "dr";
  }

  return "usa";
}

function portalBranchToId(branch: EmployeeBranch): number {
  return PORTAL_BRANCH_TO_ID[branch];
}

function activeToStatus(active: boolean | undefined): EmployeeStatus {
  return active === false ? "inactive" : "active";
}

function statusToActive(status: EmployeeStatus): boolean {
  return status === "active";
}

function normalizeEmployee(raw: unknown): Employee | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiEmployee;
  const id = item.id;
  if (id == null) return null;

  const address = item.address ?? {};
  const street = address.street ?? address.line1 ?? "";

  return {
    employeeId: String(id),
    name: String(item.name ?? "").trim(),
    department: String(item.department ?? "").trim(),
    role: String(item.title ?? "").trim(),
    branch: branchIdToPortal(item.branch?.id, address.country),
    address: street,
    city: String(address.city ?? "").trim(),
    state: String(address.state ?? address.country ?? "").trim(),
    zip: String(address.zip ?? "").trim(),
    phone: String(item.phone ?? "").trim(),
    email: String(item.email ?? "").trim(),
    startDate: item.startDate?.slice(0, 10) ?? "",
    endDate: item.endDate?.slice(0, 10) || undefined,
    status: activeToStatus(item.active),
    createdAt: item.createdAt ?? "",
    createdBy: String(item.createdBy ?? "").trim(),
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

  if (params.status && params.status !== "all") {
    searchParams.set("active", String(params.status === "active"));
  }

  if (params.branch && params.branch !== "all") {
    searchParams.set("branchId", String(portalBranchToId(params.branch)));
  }

  return searchParams.toString();
}

function formValuesToApiPayload(values: EmployeeFormValues): ApiEmployee {
  const country = values.branch === "dr" ? "DO" : "US";

  return {
    name: values.name.trim(),
    title: values.role.trim(),
    department: values.department.trim(),
    active: statusToActive(values.status),
    branch: { id: portalBranchToId(values.branch) },
    address: {
      street: values.address.trim() || undefined,
      city: values.city.trim() || undefined,
      state: values.state.trim() || undefined,
      zip: values.zip.trim() || undefined,
      country,
    },
    phone: values.phone.trim() || undefined,
    email: values.email.trim() || undefined,
    startDate: values.startDate || undefined,
    endDate: values.endDate.trim() || undefined,
  };
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
  const response = await apiClient.get<ApiEmployee | PaginatedApiEnvelope<ApiEmployee>>(
    `${API_ENDPOINTS.EMPLOYEES}/${employeeId}`,
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
  const response = await apiClient.post<ApiEmployee | PaginatedApiEnvelope<ApiEmployee>>(
    API_ENDPOINTS.EMPLOYEES,
    formValuesToApiPayload(values),
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiEmployee>).data
      : response;

  const employee = normalizeEmployee(raw);
  if (!employee) {
    throw new Error("Unable to create employee.");
  }

  return employee;
}

export async function updateEmployee(
  employeeId: string,
  values: EmployeeFormValues,
): Promise<Employee> {
  const response = await apiClient.put<ApiEmployee | PaginatedApiEnvelope<ApiEmployee>>(
    `${API_ENDPOINTS.EMPLOYEES}/${employeeId}`,
    formValuesToApiPayload(values),
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiEmployee>).data
      : response;

  const employee = normalizeEmployee(raw);
  if (!employee) {
    throw new Error("Unable to update employee.");
  }

  return employee;
}

export async function deleteEmployee(employeeId: string): Promise<void> {
  await apiClient.delete(`${API_ENDPOINTS.EMPLOYEES}/${employeeId}`);
}

export async function deleteEmployees(employeeIds: string[]): Promise<void> {
  await Promise.all(employeeIds.map((employeeId) => deleteEmployee(employeeId)));
}
