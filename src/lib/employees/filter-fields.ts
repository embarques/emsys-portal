import { EMPLOYEE_DEPARTMENTS, EMPLOYEE_GET_SEARCH_CAPABILITIES } from "@/lib/employees/types";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_FIELDS = new Set([
  "name",
  "title",
  "email",
  "id",
  "address.address1",
  "address.address2",
  "address.apartment",
  "address.city",
  "address.state",
  "address.country",
  "address.zipcode",
  "branch.code",
]);

const TEXT_FILTER_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;

const PHONE_FILTER_OPERATORS =
  EMPLOYEE_GET_SEARCH_CAPABILITIES.find((entry) => entry.field === "phones.number")?.operators ?? [
    "startsWith",
    "contains",
    "eq",
    "neq",
  ];

export const EMPLOYEE_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  ...EMPLOYEE_GET_SEARCH_CAPABILITIES.filter((entry) => TEXT_FIELDS.has(entry.field)).map((entry) => ({
    field: entry.field,
    label: entry.label,
    operators: entry.operators,
    valueType: "text" as const,
    placeholder: `Enter ${entry.label.toLowerCase()}…`,
  })),
  {
    field: "phone",
    label: "Phone",
    operators: PHONE_FILTER_OPERATORS,
    valueType: "text",
    placeholder: "Enter phone…",
    queryFields: ["phones.number"],
  },
  {
    field: "active",
    label: "Active",
    operators: ["eq", "neq"],
    valueType: "select",
    options: [
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
  },
  {
    field: "branch.id",
    label: "Branch",
    operators: ["eq", "neq"],
    valueType: "select",
    optionsSource: "branches",
  },
  {
    field: "department",
    label: "Department",
    operators: ["eq", "neq"],
    valueType: "select",
    options: EMPLOYEE_DEPARTMENTS.map((department) => ({ value: department, label: department })),
  },
  {
    field: "startDate",
    label: "Start date",
    operators: ["eq", "neq"],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "endDate",
    label: "End date",
    operators: ["eq", "neq"],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
];
