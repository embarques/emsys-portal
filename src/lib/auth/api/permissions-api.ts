import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { apiClient } from "@/lib/api/client";
import { unwrapApiData, type ApiSuccessEnvelope } from "@/lib/auth/utils/api-response";
import type {
  Permission,
  RoleSummary,
  UserPermissionsResponse,
} from "@/lib/auth/types/permission";

const RESOURCE_TYPE_ALIASES: Record<string, string> = {
  client: "customer",
};

const RESOURCE_PERMISSION_SUFFIX: Record<string, string> = {
  customer: "Customer",
  pickup: "Pickup",
  invoice: "Invoice",
  container: "Container",
  delivery: "Delivery",
  labels: "Labels",
  user: "User",
  employee: "Employee",
  branch: "Branch",
  report: "Report",
  settings: "Settings",
  income_statement: "IncomeStatement",
  chart_account: "ChartAccount",
};

type CrudFlag = "view" | "create" | "update" | "delete" | "print";

const CRUD_TO_PERMISSION_PREFIX: Record<CrudFlag, string> = {
  view: "canView",
  create: "canCreate",
  update: "canUpdate",
  delete: "canDelete",
  print: "canPrint",
};

function normalizePortalResourceType(resourceType: string): string {
  const trimmed = resourceType.trim().toLowerCase();
  return RESOURCE_TYPE_ALIASES[trimmed] ?? trimmed;
}

function getResourcePermissionSuffix(resourceType: string): string {
  const normalized = normalizePortalResourceType(resourceType);
  if (RESOURCE_PERMISSION_SUFFIX[normalized]) {
    return RESOURCE_PERMISSION_SUFFIX[normalized];
  }

  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function hasCrudFlags(item: Record<string, unknown>): boolean {
  return (["view", "create", "update", "delete", "print"] as CrudFlag[]).some(
    (flag) => typeof item[flag] === "boolean",
  );
}

function expandCrudPermission(raw: Record<string, unknown>): Permission[] {
  const resourceTypeRaw = raw.resourceType ?? raw.resource_type;
  if (typeof resourceTypeRaw !== "string" || !resourceTypeRaw.trim()) {
    return [];
  }

  const resourceType = normalizePortalResourceType(resourceTypeRaw);
  const suffix = getResourcePermissionSuffix(resourceTypeRaw);
  const permissions: Permission[] = [];

  for (const flag of Object.keys(CRUD_TO_PERMISSION_PREFIX) as CrudFlag[]) {
    if (raw[flag] === true) {
      permissions.push({
        name: `${CRUD_TO_PERMISSION_PREFIX[flag]}${suffix}`,
        resourceType,
      });
    }
  }

  return permissions;
}

function normalizeFlatPermission(raw: Record<string, unknown>): Permission | null {
  const name = raw.name ?? raw.permissionName;
  const resourceType = raw.resourceType ?? raw.resource_type;

  if (typeof name !== "string" || typeof resourceType !== "string") {
    return null;
  }

  const trimmedName = name.trim();
  const normalizedResourceType = normalizePortalResourceType(resourceType);

  if (!trimmedName.startsWith("can")) {
    return null;
  }

  return {
    name: trimmedName,
    resourceType: normalizedResourceType,
  };
}

function normalizePermissionEntry(raw: unknown): Permission[] {
  if (!raw || typeof raw !== "object") return [];

  const item = raw as Record<string, unknown>;

  if (hasCrudFlags(item)) {
    return expandCrudPermission(item);
  }

  const flat = normalizeFlatPermission(item);
  return flat ? [flat] : [];
}

function dedupePermissions(permissions: Permission[]): Permission[] {
  const seen = new Set<string>();

  return permissions.filter((permission) => {
    const key = `${permission.resourceType}:${permission.name}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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

  const rolePermissions =
    roleRaw && typeof roleRaw === "object" && "permissions" in roleRaw
      ? (roleRaw as { permissions?: unknown }).permissions
      : undefined;
  const rolePermissionRaw = Array.isArray(rolePermissions) ? rolePermissions : [];

  const role =
    roleRaw && typeof roleRaw === "object"
      ? {
          id: (roleRaw as RoleSummary).id,
          name: String((roleRaw as RoleSummary).name ?? ""),
        }
      : { id: 0, name: "" };

  const permissions = dedupePermissions(
    [...permissionsRaw, ...rolePermissionRaw].flatMap(normalizePermissionEntry),
  );

  return { role, permissions };
}

export async function fetchUserPermissions(): Promise<UserPermissionsResponse> {
  const response = await apiClient.get<unknown>(API_ENDPOINTS.USER_PERMISSIONS);
  return normalizeUserPermissionsResponse(response);
}
