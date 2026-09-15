import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["useractivity.Activity"]. */
export const USER_ACTIVITY_API_TABLE_FIELDS = [
  { field: "activityId" },
  { field: "description" },
  { field: "id", columnId: "entityId" },
  { field: "origin" },
  { field: "quantity" },
  { field: "severity" },
  { field: "timestamp", format: "date" },
  { field: "user" },
] as const satisfies readonly ApiTableField[];
