import { getApiBaseUrl } from "@/lib/api/base-url";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { unwrapApiData, type ApiSuccessEnvelope } from "@/lib/auth/utils/api-response";
import {
  devSessionFromProfile,
  isDevSessionValid,
  readDevSession,
  type DevSession,
} from "@/lib/auth/utils/dev-session";

type DevTokenPayload = {
  idToken: string;
  email?: string;
  expiresIn?: number;
};

function readEnv(key: string): string | null {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function readDevEnvDefaults() {
  return {
    companyId: readEnv("NEXT_PUBLIC_DEV_COMPANY_ID"),
    email: readEnv("NEXT_PUBLIC_DEV_EMAIL"),
    password: readEnv("NEXT_PUBLIC_DEV_PASSWORD"),
    idToken: readEnv("NEXT_PUBLIC_DEV_ID_TOKEN"),
    name: readEnv("NEXT_PUBLIC_DEV_NAME"),
  };
}

export async function mintDevIdToken(email: string, password: string): Promise<DevTokenPayload> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured.");
  }

  const response = await fetch(`${baseUrl}${API_ENDPOINTS.AUTH_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const json = (await response.json()) as
    | ApiSuccessEnvelope<DevTokenPayload>
    | { message?: string; error?: string };

  if (!response.ok) {
    const message =
      (json && "message" in json && json.message) ||
      (json && "error" in json && json.error) ||
      `Token request failed (${response.status})`;
    throw new Error(String(message));
  }

  const data = unwrapApiData(json as ApiSuccessEnvelope<DevTokenPayload>);
  if (!data?.idToken) {
    throw new Error("Dev token response did not include idToken.");
  }

  return data;
}

export async function establishDevSession(input: {
  email: string;
  password: string;
  companyId: string;
  name?: string | null;
}): Promise<DevSession> {
  const token = await mintDevIdToken(input.email, input.password);

  return devSessionFromProfile({
    idToken: token.idToken,
    companyId: input.companyId.trim(),
    email: token.email?.trim() || input.email.trim(),
    name: input.name,
    expiresInSeconds: token.expiresIn,
  });
}

export function devSessionFromEnv(): DevSession | null {
  const env = readDevEnvDefaults();
  if (!env.companyId || !env.idToken) return null;

  const session = devSessionFromProfile({
    idToken: env.idToken,
    companyId: env.companyId,
    email: env.email || "dev@local",
    name: env.name,
  });

  return isDevSessionValid(session) ? session : null;
}

export async function devSessionFromEnvCredentials(): Promise<DevSession | null> {
  const env = readDevEnvDefaults();
  if (!env.email || !env.password || !env.companyId) return null;

  return establishDevSession({
    email: env.email,
    password: env.password,
    companyId: env.companyId,
    name: env.name,
  });
}

export async function resolveInitialDevSession(): Promise<DevSession | null> {
  const cached = readDevSession();
  if (cached) return cached;

  const fromTokenEnv = devSessionFromEnv();
  if (fromTokenEnv) return fromTokenEnv;

  try {
    return await devSessionFromEnvCredentials();
  } catch (error) {
    console.warn("Dev env auto-login failed:", error);
    return null;
  }
}
