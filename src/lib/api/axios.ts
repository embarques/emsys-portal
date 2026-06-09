import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { resolveIdToken } from "@/lib/api/auth-transport";
import { getApiBaseUrl } from "@/lib/api/base-url";
import { store } from "@/lib/store/store";
import { setAuthTransport } from "@/lib/store/auth/auth-slice";

const apiBaseUrl = getApiBaseUrl();

export const axiosInstance = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

type RetriedAxiosRequestConfig = InternalAxiosRequestConfig & {
  _retriedAfterRefresh?: boolean;
};

axiosInstance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const idToken = await resolveIdToken(false);
  const { companyId } = store.getState().auth;

  if (idToken) {
    config.headers.set("authorization", `Bearer ${idToken}`);
  }

  if (companyId) {
    config.headers.set("x-company-id", companyId);
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriedAxiosRequestConfig | undefined;
    const status = error.response?.status;

    // Only retry expired sessions. A 403 is usually a real permission denial.
    if (!config || config._retriedAfterRefresh || status !== 401) {
      return Promise.reject(error);
    }

    const refreshedToken = await resolveIdToken(true);
    if (!refreshedToken) {
      return Promise.reject(error);
    }

    const { companyId } = store.getState().auth;
    dispatchFreshTransport(refreshedToken, companyId);

    config._retriedAfterRefresh = true;
    config.headers.set("authorization", `Bearer ${refreshedToken}`);
    return axiosInstance(config);
  },
);

function dispatchFreshTransport(idToken: string, companyId: string | null) {
  store.dispatch(
    setAuthTransport({
      idToken,
      companyId,
    }),
  );
}

export type ApiError = {
  message: string;
  status?: number;
};

function isGenericAxiosStatusMessage(message: string): boolean {
  return /^Request failed with status code \d+$/i.test(message.trim());
}

export function normalizeApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; error?: string }>;
    const status = axiosError.response?.status;
    const apiMessage = axiosError.response?.data?.message;
    const apiError = axiosError.response?.data?.error;
    const rawMessage =
      (apiMessage && apiMessage !== "Invalid request" ? apiMessage : null) ||
      apiError ||
      apiMessage ||
      axiosError.message ||
      "Request failed";

    if (status === 401) {
      return {
        message: "Your session has expired. Please sign out and sign in again.",
        status,
      };
    }

    if (status === 403) {
      const detail = String(rawMessage).trim();
      if (detail && !isGenericAxiosStatusMessage(detail)) {
        return { message: detail, status };
      }

      return {
        message:
          "This action is forbidden. Your account may lack the required permission, or your session may have expired — try signing out and back in.",
        status,
      };
    }

    if (isGenericAxiosStatusMessage(String(rawMessage))) {
      return {
        message: status ? `Request failed (${status}).` : "Request failed.",
        status,
      };
    }

    return {
      message: String(rawMessage),
      status,
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: "Request failed" };
}
