import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { unwrapApiData, type ApiSuccessEnvelope } from "@/lib/auth/utils/api-response";
import type {
  Permission,
  RoleSummary,
  UserPermissionsResponse,
} from "@/lib/auth/types/permission";

function normalizePermission(raw: unknown): Permission | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as Record<string, unknown>;
  const name = item.name ?? item.permissionName;
  const resourceType = item.resourceType ?? item.resource_type;

  if (typeof name !== "string" || typeof resourceType !== "string") {
    return null;
  }

  return {
    name: name.trim(),
    resourceType: resourceType.trim(),
  };
}

function normalizeUserPermissionsResponse(payload: unknown): UserPermissionsResponse {
  const body = unwrapApiData(
    payload as UserPermissionsResponse | ApiSuccessEnvelope<UserPermissionsResponse>,
  );

  const roleRaw =
    body && typeof body === "object" && "role" in body
      ? (body as UserPermissionsResponse).role
      : null;
  const permissionsRaw =
    body && typeof body === "object" && "permissions" in body
      ? (body as UserPermissionsResponse).permissions
      : [];

  const role =
    roleRaw && typeof roleRaw === "object"
      ? {
          id: (roleRaw as RoleSummary).id,
          name: String((roleRaw as RoleSummary).name ?? ""),
        }
      : { id: 0, name: "" };

  const permissions = Array.isArray(permissionsRaw)
    ? permissionsRaw
        .map(normalizePermission)
        .filter((item): item is Permission => item != null)
    : [];

  return { role, permissions };
}

export async function fetchUserPermissions(): Promise<UserPermissionsResponse> {
  const response = await apiClient.get<unknown>(API_ENDPOINTS.USER_PERMISSIONS);
  return normalizeUserPermissionsResponse(response);
}
