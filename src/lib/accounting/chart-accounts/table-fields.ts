import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["chartaccount.ChartAccount"]. */
export const CHART_ACCOUNT_API_TABLE_FIELDS = [
  { field: "branch" },
  { field: "branchAccount", defaultVisible: false, sortField: "branchAccount" },
  { field: "createdAt", format: "date", defaultVisible: false, sortField: "createdAt" },
  { field: "createdBy", defaultVisible: false },
  { field: "default", defaultVisible: false, sortField: "default" },
  { field: "description", defaultVisible: false },
  { field: "displayName" },
  { field: "id", defaultVisible: false },
  { field: "name", defaultVisible: false, sortField: "name" },
  { field: "parentAccount", columnId: "parent", defaultVisible: false },
  { field: "systemAccount", columnId: "system", defaultVisible: false },
  { field: "type" },
  { field: "updatedAt", format: "date", defaultVisible: false, sortField: "updatedAt" },
  { field: "updatedBy", defaultVisible: false },
] as const satisfies readonly ApiTableField[];
