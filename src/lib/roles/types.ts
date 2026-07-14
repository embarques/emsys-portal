import { DEFAULT_CREATED_BY } from "@/lib/audit/constants";
import type { ApiListSortInput } from "@/lib/api/list-query";
import { createListTextSearch, type ApiListTextSearch } from "@/lib/api/search-query";
import { isCompleteFilterRow, type TableFilterRowState } from "@/lib/table/filter-builder";
import { ROLE_TABLE_FILTER_FIELDS } from "@/lib/roles/filter-fields";
import { areFormValuesEquivalent } from "@/lib/forms/are-form-values-equivalent";

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
  /** Display name from API `createdBy` (string, user object, or nested `user`). */
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
  rows: TableFilterRowState[];
};

export type RoleSearchFilter = ApiListTextSearch;

export type RoleListParams = {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: ApiListSortInput;
  search?: RoleSearchFilter;
  filterRows?: TableFilterRowState[];
};

/** GET /roles?page=1&limit=50&sort=name:asc */
export const DEFAULT_ROLE_LIST_PARAMS = {
  page: 1,
  limit: 50,
  sort: "name:asc",
} as const satisfies Pick<RoleListParams, "page" | "limit" | "sort">;

export function createRoleSearchFilter(value: string): RoleSearchFilter | undefined {
  return createListTextSearch(value);
}

export function buildRoleListParams(input: {
  page: number;
  limit?: number;
  query: string;
  rows: TableFilterRowState[];
  sort?: ApiListSortInput;
}): RoleListParams {
  const params: RoleListParams = {
    ...DEFAULT_ROLE_LIST_PARAMS,
    page: input.page,
    limit: input.limit ?? DEFAULT_ROLE_LIST_PARAMS.limit,
    sort: input.sort ?? DEFAULT_ROLE_LIST_PARAMS.sort,
  };

  const search = createRoleSearchFilter(input.query);
  if (search) {
    params.search = search;
  }

  const completeRows = input.rows.filter((row) =>
    isCompleteFilterRow(row, ROLE_TABLE_FILTER_FIELDS),
  );
  if (completeRows.length > 0) {
    params.filterRows = completeRows;
  }

  return params;
}

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

export function areRoleFormValuesEquivalent(
  left: RoleFormValues,
  right: RoleFormValues,
): boolean {
  return areFormValuesEquivalent(left, right);
}

