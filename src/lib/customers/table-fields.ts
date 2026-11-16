import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for .reference/emsys-api/docs/swagger.json definitions["customer.Customer"]. */
export const CUSTOMER_API_TABLE_FIELDS = [
  // Optimistic concurrency token; consumed by mutations, never displayed as customer data.
  { field: "version", column: false },
  { field: "IDNumber", defaultVisible: false },
  { field: "accountBalance", defaultVisible: false },
  { field: "active", defaultVisible: false },
  { field: "addresses", columnId: "address" },
  { field: "branch", defaultVisible: false },
  { field: "createdAt", format: "date" },
  { field: "createdBy", defaultVisible: false },
  { field: "customerType" },
  { field: "email", defaultVisible: false },
  { field: "id", defaultVisible: false },
  { field: "name" },
  { field: "notes", defaultVisible: false },
  { field: "phones", columnId: "phone" },
  { field: "receivers", defaultVisible: false },
  { field: "updatedAt", format: "date", defaultVisible: false },
  { field: "updatedBy", defaultVisible: false },
] as const satisfies readonly ApiTableField[];
