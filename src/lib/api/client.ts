import type { AxiosRequestConfig } from "axios";

import { axiosInstance } from "@/lib/api/axios";

export const apiClient = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    axiosInstance.get<T>(url, config).then((response) => response.data),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    axiosInstance.post<T>(url, data, config).then((response) => response.data),
  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    axiosInstance.put<T>(url, data, config).then((response) => response.data),
  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    axiosInstance.patch<T>(url, data, config).then((response) => response.data),
  delete: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    axiosInstance
      .delete<T>(url, data !== undefined ? { ...config, data } : config)
      .then((response) => response.data),
};
