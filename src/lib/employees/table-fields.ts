import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["employee.Employee"]. */
export const EMPLOYEE_API_TABLE_FIELDS = [
  { field: "active" },
  { field: "address" },
  { field: "branch" },
  { field: "cost" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "department" },
  { field: "email" },
  { field: "endDate", format: "date" },
  { field: "id" },
  { field: "loanAmountOwed" },
  { field: "loanBalanceUpdated" },
  { field: "name" },
  { field: "phones" },
  { field: "startDate", format: "date" },
  { field: "title" },
  { field: "totalLoanGiven" },
  { field: "totalPaymentReceived" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
  { field: "user" },
] as const satisfies readonly ApiTableField[];
