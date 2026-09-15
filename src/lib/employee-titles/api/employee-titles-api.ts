import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { unwrapApiData, type ApiSuccessEnvelope } from "@/lib/auth/utils/api-response";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import { titleSchema, titleFormSchema } from "@/lib/employee-titles/schemas/title.schema";
import type { EmployeeTitle, EmployeeTitleFormValues } from "@/lib/employee-titles/types";

const endpoint = API_ENDPOINTS.EMPLOYEE_TITLES;
function detailPath(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid title ID.");
  return `${endpoint}/${id}`;
}
export async function fetchEmployeeTitles(page = 1, limit = 40): Promise<PaginatedResult<EmployeeTitle>> {
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(`${endpoint}?page=${page}&limit=${limit}&sort=name:asc`);
  assertMutationSuccess(response, "Unable to load titles.");
  const items = titleSchema.array().parse(response.data);
  return { items, page: response.page ?? page, resultsPerPage: response.resultsPerPage ?? items.length, total: response.total ?? items.length };
}
export async function fetchAllEmployeeTitles(): Promise<EmployeeTitle[]> {
  const items: EmployeeTitle[] = [];
  for (let page = 1; ; page++) {
    const result = await fetchEmployeeTitles(page, 200);
    items.push(...result.items);
    if (!result.items.length || items.length >= result.total) return items;
  }
}
export async function fetchEmployeeTitle(id: number): Promise<EmployeeTitle> {
  const response = await apiClient.get<ApiSuccessEnvelope<unknown>>(detailPath(id));
  return titleSchema.parse(unwrapApiData(response));
}
export async function createEmployeeTitle(values: EmployeeTitleFormValues): Promise<EmployeeTitle> {
  const response = await apiClient.post<ApiSuccessEnvelope<unknown>>(endpoint, titleFormSchema.parse(values));
  assertMutationSuccess(response, "Unable to create title.");
  return titleSchema.parse(unwrapApiData(response));
}
export async function updateEmployeeTitle(id: number, values: EmployeeTitleFormValues): Promise<EmployeeTitle> {
  const response = await apiClient.put<ApiSuccessEnvelope<unknown>>(detailPath(id), titleFormSchema.parse(values));
  assertMutationSuccess(response, "Unable to update title.");
  return titleSchema.parse(unwrapApiData(response));
}
export async function deleteEmployeeTitle(id: number): Promise<void> {
  const response = await apiClient.delete<ApiSuccessEnvelope<unknown>>(detailPath(id));
  assertMutationSuccess(response, "Unable to delete title.");
}
