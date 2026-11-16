import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for .reference/emsys-api/docs/swagger.json definitions["branch.Branch"]. */
export const BRANCH_API_TABLE_FIELDS = [
  { field: "address" },
  { field: "code" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "disclaimer" },
  { field: "id" },
  { field: "logo" },
  { field: "name" },
  { field: "phones" },
  { field: "settings" },
  { field: "type" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
] as const satisfies readonly ApiTableField[];
