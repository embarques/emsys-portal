import {
  CUSTOMER_GET_SEARCH_CAPABILITIES,
} from "@/lib/customers/types";
import { CUSTOMER_ADDRESS_COUNTRY_FILTER_OPTIONS } from "@/lib/customers/customer-country";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_FIELDS = new Set(["name", "email", "IDNumber", "id", "addresses.address1"]);

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
    field: "addresses.address2",
    label: "Address line 2",
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text",
    placeholder: "Enter address line 2…",
  },
  {
    field: "addresses.city",
    label: "City",
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text",
    placeholder: "Enter city…",
  },
  {
    field: "addresses.state",
    label: "State",
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text",
    placeholder: "Enter state…",
  },
  {
    field: "addresses.zipcode",
    label: "Zip code",
    operators: [...TEXT_FILTER_OPERATORS],
    valueType: "text",
    placeholder: "Enter zip code…",
  },
  {
    field: "addresses.country",
    label: "Country",
    operators: ["eq", "neq"],
    valueType: "select",
    options: CUSTOMER_ADDRESS_COUNTRY_FILTER_OPTIONS,
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
