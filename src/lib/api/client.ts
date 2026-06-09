import { axiosInstance } from "@/lib/api/axios";

export const apiClient = {
  get: <T>(url: string) => axiosInstance.get<T>(url).then((response) => response.data),
  post: <T>(url: string, data?: unknown) =>
    axiosInstance.post<T>(url, data).then((response) => response.data),
  put: <T>(url: string, data?: unknown) =>
    axiosInstance.put<T>(url, data).then((response) => response.data),
  patch: <T>(url: string, data?: unknown) =>
    axiosInstance.patch<T>(url, data).then((response) => response.data),
  delete: <T>(url: string) => axiosInstance.delete<T>(url).then((response) => response.data),
};
