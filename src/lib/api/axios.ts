import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

import { logApiErrorDev, normalizeApiError, type ApiError } from "@/lib/api/api-error";
import { resolveIdToken } from "@/lib/api/auth-transport";
import { getApiBaseUrl } from "@/lib/api/base-url";
import { store } from "@/lib/store/store";
import { setAuthTransport } from "@/lib/store/auth/auth-slice";

export const axiosInstance = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
});

type RetriedAxiosRequestConfig = InternalAxiosRequestConfig & {
  _retriedAfterRefresh?: boolean;
};

axiosInstance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  config.baseURL = getApiBaseUrl();

  const idToken = await resolveIdToken(false);
  const { companyId } = store.getState().auth;

  if (idToken) {
    config.headers.set("authorization", `Bearer ${idToken}`);
  }

  if (companyId) {
    config.headers.set("x-company-id", companyId);
  }

  if (process.env.NODE_ENV === "development" && config.method?.toLowerCase() === "post") {
    const url = String(config.url ?? "");
    if (url.includes("/search")) {
      console.debug("[EMSYS API search request]", {
        method: config.method?.toUpperCase(),
        url: `${config.baseURL ?? ""}${url}`,
        params: config.params,
        body: config.data,
      });
    }
  }

  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    logApiErrorDev(error);

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

export type { ApiError };
export { normalizeApiError };
