import { apiClient } from "@/lib/api/client";
import { assertMutationSuccess } from "@/lib/api/mutation-response";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { buildApiListQuery } from "@/lib/api/list-query";
import { fetchPaginatedResourceList } from "@/lib/api/fetch-paginated-resource";
import {
  buildResourceSearchFilterGroups,
  buildStripeStyleSearchBody,
  hasResourceListFilters,
} from "@/lib/api/search-query";
import type { PaginatedApiEnvelope, PaginatedResult } from "@/lib/api/types";
import {
  formatPermissionGroup,
  formatPermissionLabel,
  type PermissionCatalogEntry,
} from "@/lib/roles/permissions-catalog";
import { ROLE_TABLE_FILTER_FIELDS } from "@/lib/roles/filter-fields";
import { ROLE_BAR_OR_SEARCH_FIELDS } from "@/lib/roles/search-fields";
import { expandRoleFilterNode } from "@/lib/roles/role-filters";
import {
  DEFAULT_ROLE_LIST_PARAMS,
  type Role,
  type RoleFormValues,
  type RoleListParams,
  type RolePermission,
} from "@/lib/roles/types";

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

function normalizePaginatedRoles(payload: PaginatedApiEnvelope<unknown[]>): PaginatedResult<Role> {
  const items = unwrapList(payload)
    .map(normalizeRole)
    .filter((role): role is Role => role != null);

  return {
    items,
    page: payload.page ?? 1,
    resultsPerPage: payload.resultsPerPage ?? items.length,
    total: payload.total ?? items.length,
  };
}

function hasRoleListFilters(params: RoleListParams): boolean {
  return hasResourceListFilters({
    search: params.search,
    filterRows: params.filterRows,
    tableFilterFields: ROLE_TABLE_FILTER_FIELDS,
  });
}

function buildRolesQuery(params: RoleListParams): string {
  return buildApiListQuery({
    page: params.page ?? DEFAULT_ROLE_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_ROLE_LIST_PARAMS.limit,
    offset: params.offset,
    sort: params.sort ?? DEFAULT_ROLE_LIST_PARAMS.sort,
  });
}

function buildRoleSearchBody(params: RoleListParams) {
  return buildStripeStyleSearchBody({
    sort: params.sort ?? DEFAULT_ROLE_LIST_PARAMS.sort,
    filterGroups: buildResourceSearchFilterGroups({
      search: params.search,
      barOrSearchFields: ROLE_BAR_OR_SEARCH_FIELDS,
      filterRows: params.filterRows,
      tableFilterFields: ROLE_TABLE_FILTER_FIELDS,
      expandNode: expandRoleFilterNode,
    }),
  });
}

export async function fetchRoles(params: RoleListParams = {}): Promise<PaginatedResult<Role>> {
  return fetchPaginatedResourceList({
    endpoint: API_ENDPOINTS.ROLES,
    page: params.page ?? DEFAULT_ROLE_LIST_PARAMS.page,
    limit: params.limit ?? DEFAULT_ROLE_LIST_PARAMS.limit,
    offset: params.offset,
    isFiltered: hasRoleListFilters(params),
    buildGetQuery: () => buildRolesQuery(params),
    buildSearchBody: () => buildRoleSearchBody(params),
    normalize: normalizePaginatedRoles,
  });
}

export async function fetchRoleById(roleId: string | number): Promise<Role> {
  const id = parseRoleId(roleId);
  const response = await apiClient.get<ApiRole | PaginatedApiEnvelope<ApiRole>>(
    `${API_ENDPOINTS.ROLES}/${id}`,
  );

  const raw =
    response && typeof response === "object" && "data" in response
      ? (response as PaginatedApiEnvelope<ApiRole>).data
      : response;

  const role = normalizeRole(raw);
  if (!role) {
    throw new Error("Role not found.");
  }

  return role;
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
