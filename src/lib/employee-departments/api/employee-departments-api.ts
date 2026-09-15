import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { unwrapApiData, type ApiSuccessEnvelope } from "@/lib/auth/utils/api-response";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { departmentSchema, departmentFormSchema } from "@/lib/employee-departments/schemas/department.schema";
import type { EmployeeDepartment, EmployeeDepartmentFormValues } from "@/lib/employee-departments/types";

const endpoint = API_ENDPOINTS.EMPLOYEE_DEPARTMENTS;
function detailPath(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid department ID.");
  return `${endpoint}/${id}`;
}
export async function fetchEmployeeDepartments(page = 1, limit = 40): Promise<PaginatedResult<EmployeeDepartment>> {
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(`${endpoint}?page=${page}&limit=${limit}&sort=name:asc`);
  assertMutationSuccess(response, "Unable to load departments.");
  const items = departmentSchema.array().parse(response.data);
  return { items, page: response.page ?? page, resultsPerPage: response.resultsPerPage ?? items.length, total: response.total ?? items.length };
}
export async function fetchAllEmployeeDepartments(): Promise<EmployeeDepartment[]> {
  const items: EmployeeDepartment[] = [];
  for (let page = 1; ; page++) {
    const result = await fetchEmployeeDepartments(page, 200);
    items.push(...result.items);
    if (!result.items.length || items.length >= result.total) return items;
  }
}
export async function fetchEmployeeDepartment(id: number): Promise<EmployeeDepartment> {
  const response = await apiClient.get<ApiSuccessEnvelope<unknown>>(detailPath(id));
  return departmentSchema.parse(unwrapApiData(response));
}
export async function createEmployeeDepartment(values: EmployeeDepartmentFormValues): Promise<EmployeeDepartment> {
  const response = await apiClient.post<ApiSuccessEnvelope<unknown>>(endpoint, departmentFormSchema.parse(values));
  assertMutationSuccess(response, "Unable to create department.");
  return departmentSchema.parse(unwrapApiData(response));
}
export async function updateEmployeeDepartment(id: number, values: EmployeeDepartmentFormValues): Promise<EmployeeDepartment> {
  const response = await apiClient.put<ApiSuccessEnvelope<unknown>>(detailPath(id), departmentFormSchema.parse(values));
  assertMutationSuccess(response, "Unable to update department.");
  return departmentSchema.parse(unwrapApiData(response));
}
export async function deleteEmployeeDepartment(id: number): Promise<void> {
  const response = await apiClient.delete<ApiSuccessEnvelope<unknown>>(detailPath(id));
  assertMutationSuccess(response, "Unable to delete department.");
}
