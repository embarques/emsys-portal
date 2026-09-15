import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["chartaccount.ChartAccount"]. */
export const CHART_ACCOUNT_API_TABLE_FIELDS = [
  { field: "branch" },
  { field: "branchAccount" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "default" },
  { field: "description" },
  { field: "displayName" },
  { field: "id" },
  { field: "name" },
  { field: "parentAccount", columnId: "parent" },
  { field: "systemAccount", columnId: "system" },
  { field: "type" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
] as const satisfies readonly ApiTableField[];
