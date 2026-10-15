import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["chartaccount.ChartAccount"]. */
export const CHART_ACCOUNT_API_TABLE_FIELDS = [
  { field: "branch" },
  { field: "branchAccount", defaultVisible: false },
  { field: "createdAt", format: "date", defaultVisible: false },
  { field: "createdBy", defaultVisible: false },
  { field: "default", defaultVisible: false },
  { field: "description", defaultVisible: false },
  { field: "displayName" },
  { field: "id", defaultVisible: false },
  { field: "name", defaultVisible: false },
  { field: "parentAccount", columnId: "parent", defaultVisible: false },
  { field: "systemAccount", columnId: "system", defaultVisible: false },
  { field: "type" },
  { field: "updatedAt", format: "date", defaultVisible: false },
  { field: "updatedBy", defaultVisible: false },
] as const satisfies readonly ApiTableField[];
