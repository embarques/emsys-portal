import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { Company } from "@/lib/company/types";

export async function fetchCurrentCompany(): Promise<Company> {
  const response = await apiClient.get<{ data: Company }>(API_ENDPOINTS.CURRENT_COMPANY);
  return response.data;
}
