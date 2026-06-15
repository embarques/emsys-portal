import {
  TRUCK_BRANCH_OPTIONS,
  TRUCK_FUEL_TYPES,
  TRUCK_GET_SEARCH_CAPABILITIES,
} from "@/lib/trucks/types";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_FIELDS = new Set(["truckId", "name", "vin", "createdBy", "id"]);

export const TRUCK_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  ...TRUCK_GET_SEARCH_CAPABILITIES.filter((entry) => TEXT_FIELDS.has(entry.field)).map((entry) => ({
    field: entry.field,
    label: entry.label,
    operators: entry.operators,
    valueType: "text" as const,
    placeholder: `Enter ${entry.label.toLowerCase()}…`,
  })),
  {
    field: "fuelType",
    label: "Fuel type",
    operators: ["eq", "neq"],
    valueType: "select",
    options: TRUCK_FUEL_TYPES,
  },
  {
    field: "branch",
    label: "Branch",
    operators: ["eq", "neq", "contains", "startsWith"],
    valueType: "select",
    options: TRUCK_BRANCH_OPTIONS,
  },
  {
    field: "year",
    label: "Year",
    operators: ["eq", "neq"],
    valueType: "text",
    placeholder: "Enter year…",
  },
];
