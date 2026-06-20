import { apiClient } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { buildApiListQuery } from "@/lib/api/list-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import {
  formatPermissionGroup,
  formatPermissionLabel,
  type PermissionCatalogEntry,
} from "@/lib/roles/permissions-catalog";
import type { Role, RoleFormValues, RolePermission } from "@/lib/roles/types";

const CATALOG_LIMIT = 200;

type ApiRoleUser = {
  id?: number;
  name?: string;
  userName?: string;
  fullName?: string;
};

type ApiPermission = {
  id?: number;
  _id?: number;
  name?: string;
  resourceType?: string;
};

type ApiRole = {
  id?: number;
  _id?: number;
  name?: string;
  active?: boolean;
  systemRole?: boolean;
  permissions?: ApiPermission[];
  createdAt?: string;
  updatedAt?: string;
  created?: string;
  updated?: string;
  createdBy?: string | number | ApiRoleUser;
  user?: ApiRoleUser;
};

type ApiRoleWritePayload = {
  name: string;
  active: boolean;
  permissions: Array<{ id: number }>;
};

type ApiMutationEnvelope<T = unknown> = PaginatedApiEnvelope<T> & {
  success?: boolean;
  message?: string;
  error?: string;
};

function readNumericId(value: number | string | undefined): number | undefined {
  if (value == null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizePermission(raw: unknown): RolePermission | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiPermission;
  const id = readNumericId(item.id ?? item._id);
  const name = String(item.name ?? "").trim();
  const resourceType = String(item.resourceType ?? "").trim();
  if (id == null || !name) return null;

  return {
    id: String(id),
    value: name,
    label: formatPermissionLabel(name, resourceType),
    group: formatPermissionGroup(resourceType),
  };
}

function readAuditDate(...values: unknown[]): string {
  for (const value of values) {
    const trimmed = String(value ?? "").trim();
    if (trimmed) return trimmed;
  }
  return "";
}

function readRoleCreatedBy(createdBy: unknown, user?: unknown): string {
  if (typeof createdBy === "string" && createdBy.trim()) {
    return createdBy.trim();
  }

  if (createdBy && typeof createdBy === "object") {
    const entry = createdBy as ApiRoleUser;
    const name = String(entry.fullName ?? entry.userName ?? entry.name ?? "").trim();
    if (name) return name;
  }

  if (typeof createdBy === "number" && Number.isFinite(createdBy) && createdBy > 0) {
    return String(createdBy);
  }

  if (user && typeof user === "object") {
    const entry = user as ApiRoleUser;
    const name = String(entry.fullName ?? entry.userName ?? entry.name ?? "").trim();
    if (name) return name;
  }

  return "—";
}

function normalizeRole(raw: unknown): Role | null {
  if (!raw || typeof raw !== "object") return null;

  const item = raw as ApiRole;
  const id = readNumericId(item.id ?? item._id);
  if (id == null) return null;

  const permissions = Array.isArray(item.permissions)
    ? item.permissions
        .map(normalizePermission)
        .filter((permission): permission is RolePermission => permission != null)
    : [];

  return {
    roleId: String(id),
    name: String(item.name ?? "").trim(),
    active: item.active !== false,
    systemRole: item.systemRole === true,
    permissions,
    createdAt: readAuditDate(item.createdAt, item.created),
    createdBy: readRoleCreatedBy(item.createdBy, item.user),
    updatedAt: readAuditDate(item.updatedAt, item.updated),
  };
}

function unwrapList(payload: PaginatedApiEnvelope<unknown[]>): unknown[] {
  return Array.isArray(payload.data) ? payload.data : [];
}

function assertMutationSuccess(response: ApiMutationEnvelope<unknown>, fallbackMessage: string) {
  if (response.success === false) {
    throw new Error(response.error?.trim() || response.message?.trim() || fallbackMessage);
  }
}

function parseRoleId(roleId: string | number): number {
  const id = readNumericId(roleId);
  if (id == null) throw new Error("Invalid role ID.");
  return id;
}

function buildRolePayload(values: RoleFormValues): ApiRoleWritePayload {
  return {
    name: values.name.trim(),
    active: values.active,
    permissions: values.permissions.map((permission) => ({
      id: parseRoleId(permission.id),
    })),
  };
}

export async function fetchRoles(): Promise<PaginatedResult<Role>> {
  const query = buildApiListQuery({ page: 1, limit: CATALOG_LIMIT, sort: "name:asc" });
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.ROLES}?${query}`,
  );
  const items = unwrapList(response)
    .map(normalizeRole)
    .filter((role): role is Role => role != null);

  return {
    items,
    page: response.page ?? 1,
    resultsPerPage: response.resultsPerPage ?? items.length,
    total: response.total ?? items.length,
  };
}

export async function fetchPermissionCatalog(): Promise<PermissionCatalogEntry[]> {
  const query = buildApiListQuery({ page: 1, limit: CATALOG_LIMIT, sort: "resourceType:asc,name:asc" });
  const response = await apiClient.get<PaginatedApiEnvelope<unknown[]>>(
    `${API_ENDPOINTS.PERMISSIONS}?${query}`,
  );

  return unwrapList(response)
    .map((raw): PermissionCatalogEntry | null => {
      if (!raw || typeof raw !== "object") return null;
      const item = raw as ApiPermission;
      const id = readNumericId(item.id ?? item._id);
      const name = String(item.name ?? "").trim();
      const resourceType = String(item.resourceType ?? "").trim();
      if (id == null || !name || !resourceType) return null;

      return {
        id: String(id),
        value: name,
        label: formatPermissionLabel(name, resourceType),
        group: formatPermissionGroup(resourceType),
      };
    })
    .filter((permission): permission is PermissionCatalogEntry => permission != null);
}

export async function createRole(values: RoleFormValues): Promise<Role> {
  const response = await apiClient.post<ApiMutationEnvelope<ApiRole>>(
    API_ENDPOINTS.ROLES,
    buildRolePayload(values),
  );
  assertMutationSuccess(response, "Unable to create role.");

  const role = normalizeRole(response.data);
  if (!role) throw new Error("Unable to read the created role.");
  return role;
}

export async function updateRole(roleId: string, values: RoleFormValues): Promise<Role> {
  const id = parseRoleId(roleId);
  const response = await apiClient.put<ApiMutationEnvelope<ApiRole>>(
    `${API_ENDPOINTS.ROLES}/${id}`,
    buildRolePayload(values),
  );
  assertMutationSuccess(response, "Unable to update role.");

  const role = normalizeRole(response.data);
  if (!role) throw new Error("Unable to read the updated role.");
  return role;
}

export async function deleteRole(roleId: string): Promise<void> {
  const id = parseRoleId(roleId);
  const response = await apiClient.delete<ApiMutationEnvelope<unknown>>(
    `${API_ENDPOINTS.ROLES}/${id}`,
  );
  assertMutationSuccess(response, "Unable to delete role.");
}

export async function deleteRoles(roleIds: string[]): Promise<void> {
  await Promise.all(roleIds.map(deleteRole));
}
