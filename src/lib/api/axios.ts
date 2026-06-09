import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { getApiBaseUrl } from "@/lib/api/base-url";
import { store } from "@/lib/store/store";

const apiBaseUrl = getApiBaseUrl();

export const axiosInstance = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { idToken, companyId } = store.getState().auth;

  if (idToken) {
    config.headers.set("authorization", `Bearer ${idToken}`);
  }

  if (companyId) {
    config.headers.set("x-company-id", companyId);
  }

  return config;
});

export type ApiError = {
  message: string;
  status?: number;
};

export function normalizeApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; error?: string }>;
    const message =
      axiosError.response?.data?.message ||
      axiosError.response?.data?.error ||
      axiosError.message ||
      "Request failed";

    return {
      message: String(message),
      status: axiosError.response?.status,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: "Request failed" };
}
