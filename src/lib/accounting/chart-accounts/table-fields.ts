import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for .reference/emsys-api/docs/swagger.json definitions["chartaccount.ChartAccount"]. */
export const CHART_ACCOUNT_API_TABLE_FIELDS = [
  // Master-chart structure/posting controls are modeled by the feature, not raw generated columns.
  { field: "classification", column: false },
  { field: "code", column: false },
  { field: "codeRange", column: false },
  { field: "customizationPolicy", column: false },
  { field: "nonPosting", column: false },
  { field: "subType", column: false },
  { field: "templateLayer", column: false },
  { field: "templateVersion", column: false },
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
