import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const DATE_OPERATORS = ["eq", "neq", "gte", "lte"] as const;
const NUMERIC_OPERATORS = ["eq", "neq", "gte", "lte", "gt", "lt"] as const;

export const LOAN_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "transactionDate",
    label: "Transaction date",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "transactionDateRange",
    label: "Transaction date range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-06-13 to 2026-08-14",
  },
  {
    field: "openedAt",
    label: "Opened date",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "openedAtRange",
    label: "Opened date range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-06-13 to 2026-08-14",
  },
  {
    field: "lastActivityAt",
    label: "Last activity date",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "lastActivityAtRange",
    label: "Last activity date range",
    operators: ["eq"],
    valueType: "range",
    placeholder: "2026-06-13 to 2026-08-14",
  },
  {
    field: "employee.name",
    label: "Employee",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter employee name...",
  },
  {
    field: "status",
    label: "Status",
    operators: ["eq", "neq"],
    valueType: "select",
    options: [
      { value: "ACTIVE", label: "Active" },
      { value: "PAID", label: "Paid" },
      { value: "VOID", label: "Void" },
    ],
  },
  {
    field: "loanAccount.id",
    label: "Loan account",
    operators: ["eq", "neq"],
    valueType: "select",
    optionsSource: "loanAccounts",
  },
  {
    field: "principalAmount",
    label: "Principal amount",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter amount...",
  },
  {
    field: "paidAmount",
    label: "Paid amount",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter amount...",
  },
  {
    field: "balance",
    label: "Balance",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter amount...",
  },
];
