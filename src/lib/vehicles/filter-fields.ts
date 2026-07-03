import {
  VEHICLE_BRANCH_OPTIONS,
  VEHICLE_FUEL_TYPES,
  VEHICLE_GET_SEARCH_CAPABILITIES,
} from "@/lib/vehicles/types";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_FIELDS = new Set(["vehicleId", "name", "vin", "licensePlate", "createdBy.name", "id"]);

export const VEHICLE_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  ...VEHICLE_GET_SEARCH_CAPABILITIES.filter((entry) => TEXT_FIELDS.has(entry.field)).map((entry) => ({
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
    options: VEHICLE_FUEL_TYPES,
  },
  {
    field: "branch.code",
    label: "Branch",
    operators: ["eq", "neq", "contains", "startsWith"],
    valueType: "select",
    options: VEHICLE_BRANCH_OPTIONS,
  },
  {
    field: "active",
    label: "Status",
    operators: ["eq", "neq"],
    valueType: "select",
    options: [
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ],
  },
  {
    field: "year",
    label: "Year",
    operators: ["eq", "neq"],
    valueType: "text",
    placeholder: "Enter year…",
  },
];
