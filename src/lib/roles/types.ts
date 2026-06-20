import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";

export type RolePermission = {
  id: string;
  value: string;
  label?: string;
  group?: string;
};

export type Role = {
  roleId: string;
  name: string;
  active: boolean;
  systemRole: boolean;
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
  active: boolean;
  permissions: RolePermissionFormValues[];
  createdBy: string;
};

export type RoleFilterState = {
  query: string;
};

export function createEmptyRoleForm(createdBy = DEFAULT_CREATED_BY): RoleFormValues {
  return {
    roleId: "",
    name: "",
    active: true,
    permissions: [],
    createdBy,
  };
}

export function roleToFormValues(role: Role): RoleFormValues {
  return {
    roleId: role.roleId,
    name: role.name,
    active: role.active,
    permissions: role.permissions.map((permission) => ({
      id: permission.id,
      value: permission.value,
    })),
    createdBy: role.createdBy,
  };
}
