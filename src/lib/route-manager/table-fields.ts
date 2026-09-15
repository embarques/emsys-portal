import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["route.Route"]. */
export const ROUTE_API_TABLE_FIELDS = [
  { field: "active" },
  { field: "branch" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "employees" },
  { field: "id" },
  { field: "name" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
  { field: "vehicle" },
] as const satisfies readonly ApiTableField[];
