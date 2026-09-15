import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["user.User"]. */
export const USER_API_TABLE_FIELDS = [
  { field: "active" },
  { field: "branch" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "email" },
  { field: "endTime" },
  { field: "id" },
  { field: "name" },
  { field: "role", columnId: "role.name" },
  { field: "startTime" },
  { field: "uid" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
] as const satisfies readonly ApiTableField[];
