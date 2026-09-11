import { EMPLOYEE_DEPARTMENTS } from "@/lib/employees/types";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const NUMERIC_OPERATORS = ["eq", "neq", "gte", "lte", "gt", "lt"] as const;
const DATE_OPERATORS = ["eq", "neq", "gte", "lte"] as const;

/**
 * Advanced filter fields for employees. `id`, `cost`, and `active` are coerced to
 * number/boolean in `expandEmployeeFilterNode` because the strict API requires JSON
 * numbers/booleans for those fields. Branch filtering uses `branch.code` (a string)
 * because employee records only carry `branch.code`, not `branch.id`.
 */
export const EMPLOYEE_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "id",
    label: "Employee ID",
    operators: ["eq", "neq", "gte", "lte"],
    valueType: "text",
    placeholder: "Enter employee ID…",
  },
  { field: "name", label: "Name", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter name…" },
  { field: "title", label: "Title", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter title…" },
  { field: "email", label: "Email", operators: [...TEXT_OPERATORS], valueType: "text", placeholder: "Enter email…" },
  {
    field: "phone",
    label: "Phone",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter phone…",
    queryFields: ["phones.number"],
  },
  {
    field: "address.address1",
    label: "Address line 1",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter address line 1…",
  },
  {
    field: "address.address2",
    label: "Address line 2",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter address line 2…",
  },
  {
    field: "address.apartment",
    label: "Apartment",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter apartment…",
  },
  {
    field: "address.city",
    label: "City",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter city…",
  },
  {
    field: "address.state",
    label: "State",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter state…",
  },
  {
    field: "address.zipcode",
    label: "Zip code",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter zip code…",
  },
  {
    field: "address.country",
    label: "Country",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter country…",
  },
  {
    field: "department",
    label: "Department",
    operators: ["eq", "neq"],
    valueType: "select",
    options: EMPLOYEE_DEPARTMENTS.map((department) => ({ value: department, label: department })),
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
    field: "branch.code",
    label: "Branch",
    operators: ["eq", "neq"],
    valueType: "select",
    optionsSource: "branches",
  },
  {
    field: "cost",
    label: "Cost",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter amount…",
  },
  {
    field: "createdAt",
    label: "Created at",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
];
