import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["role.Role"]. */
export const ROLE_API_TABLE_FIELDS = [
  { field: "active" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "id", columnId: "roleId" },
  { field: "name" },
  { field: "permissions" },
  { field: "systemRole" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
] as const satisfies readonly ApiTableField[];
