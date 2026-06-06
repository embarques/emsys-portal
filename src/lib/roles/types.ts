import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import { createRecordId } from "@/lib/customers/types";

export type RolePermission = {
  id: string;
  value: string;
};

export type Role = {
  roleId: string;
  name: string;
  permissions: RolePermission[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type RolePermissionFormValues = {
  id: string;
  value: string;
};

export type RoleFormValues = {
  roleId: string;
  name: string;
  permissions: RolePermissionFormValues[];
  createdBy: string;
};

export type RoleFilterState = {
  query: string;
};

export function createRoleId(): string {
  return createRecordId();
}

export function createPermissionId(): string {
  return crypto.randomUUID();
}

export function createEmptyPermission(): RolePermissionFormValues {
  return { id: createPermissionId(), value: "" };
}

export function createEmptyRoleForm(createdBy = DEFAULT_CREATED_BY): RoleFormValues {
  return {
    roleId: createRoleId(),
    name: "",
    permissions: [createEmptyPermission()],
    createdBy,
  };
}

export function permissionsFromValues(values: string[]): RolePermissionFormValues[] {
  const unique = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  return unique.length > 0
    ? unique.map((value) => ({ id: createPermissionId(), value }))
    : [createEmptyPermission()];
}

export function roleToFormValues(role: Role): RoleFormValues {
  return {
    roleId: role.roleId,
    name: role.name,
    permissions:
      role.permissions.length > 0
        ? role.permissions.map((permission) => ({ id: permission.id, value: permission.value }))
        : [createEmptyPermission()],
    createdBy: role.createdBy,
  };
}

export function normalizePermissions(permissions: RolePermissionFormValues[]): RolePermission[] {
  const seen = new Set<string>();
  const normalized: RolePermission[] = [];

  for (const permission of permissions) {
    const value = permission.value.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    normalized.push({ id: permission.id || createPermissionId(), value });
  }

  return normalized;
}

export function formValuesToRole(
  values: RoleFormValues,
  createdAt?: string,
  createdBy?: string,
  updatedAt?: string
): Role {
  if (!values.name.trim()) {
    throw new Error("Role name is required.");
  }

  const permissions = normalizePermissions(values.permissions);
  if (permissions.length === 0) {
    throw new Error("Add at least one permission.");
  }

  return {
    roleId: values.roleId,
    name: values.name.trim(),
    permissions,
    createdAt: createdAt ?? new Date().toISOString(),
    createdBy: createdBy ?? (values.createdBy.trim() || DEFAULT_CREATED_BY),
    updatedAt: updatedAt ?? new Date().toISOString(),
  };
}

export function copyPermissionsFromRole(source: Role): RolePermissionFormValues[] {
  return source.permissions.map((permission) => ({
    id: createPermissionId(),
    value: permission.value,
  }));
}
