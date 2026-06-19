import axios, { type AxiosError } from "axios";

export const API_UNREACHABLE_MESSAGE =
  "Unable to connect to the API. The server may be down or unreachable. Please try again later.";

export const TEMPORARY_UNAVAILABLE_STATUSES = [502, 503, 521, 524] as const;

export type ApiErrorCategory =
  | "unreachable"
  | "temporary_unavailable"
  | "auth"
  | "forbidden"
  | "client"
  | "server"
  | "unknown";

export type ClassifiedApiError = {
  message: string;
  status?: number;
  category: ApiErrorCategory;
  isConnectivityFailure: boolean;
};

/** @deprecated Use ClassifiedApiError */
export type ApiError = Pick<ClassifiedApiError, "message" | "status"> & {
  category?: ApiErrorCategory;
  isConnectivityFailure?: boolean;
};

function isGenericAxiosStatusMessage(message: string): boolean {
  return /^Request failed with status code \d+$/i.test(message.trim());
}

function looksLikeOpaqueNetworkMessage(message: string): boolean {
  return /cors|access-control-allow-origin|cross-origin|network error|failed to fetch|net::err/i.test(
    message,
  );
}

export function isTemporaryUnavailableStatus(
  status: number | undefined,
): status is (typeof TEMPORARY_UNAVAILABLE_STATUSES)[number] {
  return (
    status != null &&
    (TEMPORARY_UNAVAILABLE_STATUSES as readonly number[]).includes(status)
  );
}

function isAxiosNetworkFailure(error: AxiosError): boolean {
  if (error.response != null) return false;

  return (
    error.code === "ERR_NETWORK" ||
    error.code === "ECONNABORTED" ||
    error.code === "ETIMEDOUT" ||
    looksLikeOpaqueNetworkMessage(error.message)
  );
}

function readApiErrorPayload(error: AxiosError<{ message?: string; error?: string }>): {
  status?: number;
  rawMessage: string;
} {
  const status = error.response?.status;
  const apiMessage = error.response?.data?.message;
  const apiError = error.response?.data?.error;
  const rawMessage =
    (apiMessage && apiMessage !== "Invalid request" ? apiMessage : null) ||
    apiError ||
    apiMessage ||
    error.message ||
    "Request failed";

  return { status, rawMessage: String(rawMessage) };
}

export function classifyApiError(error: unknown): ClassifiedApiError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; error?: string }>;
    const { status, rawMessage } = readApiErrorPayload(axiosError);

    if (isTemporaryUnavailableStatus(status)) {
      return {
        message: `API server is temporarily unavailable (HTTP ${status}).`,
        status,
        category: "temporary_unavailable",
        isConnectivityFailure: true,
      };
    }

    if (isAxiosNetworkFailure(axiosError)) {
      return {
        message: API_UNREACHABLE_MESSAGE,
        status: undefined,
        category: "unreachable",
        isConnectivityFailure: true,
      };
    }

    if (status === 401) {
      return {
        message: "Your session has expired. Please sign out and sign in again.",
        status,
        category: "auth",
        isConnectivityFailure: false,
      };
    }

    if (status === 403) {
      const detail = rawMessage.trim();
      if (detail && !isGenericAxiosStatusMessage(detail)) {
        return {
          message: detail,
          status,
          category: "forbidden",
          isConnectivityFailure: false,
        };
      }

      return {
        message:
          "This action is forbidden. Your account may lack the required permission, or your session may have expired — try signing out and back in.",
        status,
        category: "forbidden",
        isConnectivityFailure: false,
      };
    }

    if (looksLikeOpaqueNetworkMessage(rawMessage) && axiosError.response == null) {
      return {
        message: API_UNREACHABLE_MESSAGE,
        status: undefined,
        category: "unreachable",
        isConnectivityFailure: true,
      };
    }

    if (isGenericAxiosStatusMessage(rawMessage)) {
      return {
        message: status ? `Request failed (${status}).` : "Request failed.",
        status,
        category: status && status >= 500 ? "server" : status && status >= 400 ? "client" : "unknown",
        isConnectivityFailure: false,
      };
    }

    return {
      message: rawMessage,
      status,
      category: status && status >= 500 ? "server" : status && status >= 400 ? "client" : "unknown",
      isConnectivityFailure: false,
    };
  }

  if (error instanceof TypeError && looksLikeOpaqueNetworkMessage(error.message)) {
    return {
      message: API_UNREACHABLE_MESSAGE,
      category: "unreachable",
      isConnectivityFailure: true,
    };
  }

  if (error instanceof Error) {
    if (looksLikeOpaqueNetworkMessage(error.message)) {
      return {
        message: API_UNREACHABLE_MESSAGE,
        category: "unreachable",
        isConnectivityFailure: true,
      };
    }

    return {
      message: error.message,
      category: "unknown",
      isConnectivityFailure: false,
    };
  }

  return {
    message: "Request failed",
    category: "unknown",
    isConnectivityFailure: false,
  };
}

export function normalizeApiError(error: unknown): ApiError {
  const classified = classifyApiError(error);

  return {
    message: classified.message,
    status: classified.status,
    category: classified.category,
    isConnectivityFailure: classified.isConnectivityFailure,
  };
}

export function logApiErrorDev(error: unknown, context?: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== "development") return;

  if (axios.isAxiosError(error)) {
    console.debug("[EMSYS API error]", {
      ...context,
      message: error.message,
      code: error.code,
      status: error.response?.status,
      url: error.config?.url,
      method: error.config?.method,
      data: error.response?.data,
    });
    return;
  }

  console.debug("[EMSYS API error]", context, error);
}
