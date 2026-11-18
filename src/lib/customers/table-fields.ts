import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for .reference/emsys-api/docs/swagger.json definitions["customer.Customer"]. */
export const CUSTOMER_API_TABLE_FIELDS = [
  // Optimistic concurrency token; consumed by mutations, never displayed as customer data.
  { field: "version", column: false },
  // Most → least important (matches customers-workspace tableColumns; extras append after).
  { field: "name" },
  { field: "customerType" },
  { field: "phones", columnId: "phone" },
  { field: "addresses", columnId: "address" },
  { field: "IDNumber", defaultVisible: false },
  { field: "email", defaultVisible: false },
  { field: "accountBalance", defaultVisible: false },
  { field: "notes", defaultVisible: false },
  { field: "createdAt", format: "date" },
  { field: "createdBy", defaultVisible: false },
  { field: "updatedAt", format: "date", defaultVisible: false },
  { field: "updatedBy", defaultVisible: false },
  { field: "active", defaultVisible: false },
  { field: "branch", defaultVisible: false },
  { field: "id", defaultVisible: false },
  { field: "receivers", defaultVisible: false },
] as const satisfies readonly ApiTableField[];
