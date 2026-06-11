import {
  CUSTOMER_GET_SEARCH_CAPABILITIES,
} from "@/lib/customers/types";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_FIELDS = new Set(["name", "email", "IDNumber", "oldID", "address.address1"]);

const TEXT_FILTER_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;

const PHONE_FILTER_OPERATORS =
  CUSTOMER_GET_SEARCH_CAPABILITIES.find((entry) => entry.field === "phones.number")?.operators ?? [
    "startsWith",
    "contains",
    "eq",
    "neq",
  ];

const CUSTOMER_ADDRESS_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "address.address2",
    label: "Address line 2",
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text",
    placeholder: "Enter address line 2…",
  },
  {
    field: "address.city",
    label: "City",
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text",
    placeholder: "Enter city…",
  },
  {
    field: "address.state",
    label: "State",
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text",
    placeholder: "Enter state…",
  },
  {
    field: "address.zipcode",
    label: "Zip code",
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text",
    placeholder: "Enter zip code…",
  },
  {
    field: "address.country",
    label: "Country",
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text",
    placeholder: "Enter country…",
  },
];

export const CUSTOMER_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  ...CUSTOMER_GET_SEARCH_CAPABILITIES.filter((entry) => TEXT_FIELDS.has(entry.field)).map(
    (entry) => ({
      field: entry.field,
      label: entry.label,
      operators: entry.operators,
      valueType: "text" as const,
      placeholder: `Enter ${entry.label.toLowerCase()}…`,
    }),
  ),
  ...CUSTOMER_ADDRESS_FILTER_FIELDS,
  {
    field: "phone",
    label: "Phone",
    operators: PHONE_FILTER_OPERATORS,
    valueType: "text",
    placeholder: "Enter phone…",
    queryFields: ["phones.number"],
  },
  {
    field: "customerType",
    label: "Customer type",
    operators: ["eq", "neq"],
    valueType: "select",
    optionsSource: "customerTypes",
  },
  {
    field: "branch.id",
    label: "Branch",
    operators: ["eq", "neq"],
    valueType: "select",
    optionsSource: "branches",
  },
];
