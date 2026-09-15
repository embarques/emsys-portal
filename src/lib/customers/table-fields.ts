import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["customer.Customer"]. */
export const CUSTOMER_API_TABLE_FIELDS = [
  { field: "IDNumber" },
  { field: "accountBalance" },
  { field: "active" },
  { field: "addresses" },
  { field: "branch" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "customerType" },
  { field: "email" },
  { field: "id" },
  { field: "name" },
  { field: "notes" },
  { field: "phones" },
  { field: "receivers" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
] as const satisfies readonly ApiTableField[];
