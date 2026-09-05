import { DAYS_OF_WEEK, type RouteType } from "@/lib/pickup-delivery-routes/types";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";

const TEXT_OPERATORS = ["startsWith", "contains", "eq", "neq"] as const;
const NUMERIC_OPERATORS = ["eq", "neq", "gte", "lte", "gt", "lt"] as const;
const DATE_OPERATORS = ["eq", "neq", "gte", "lte", "gt", "lt"] as const;

export const ACTIVE_ROUTE_NUMERIC_FIELDS: ReadonlySet<string> = new Set([
  "branch.id",
  "container.id",
  "employees.id",
  "tripNumber",
  "rate",
]);

export const ACTIVE_ROUTE_BOOLEAN_FIELDS: ReadonlySet<string> = new Set(["active"]);

const CREW_ROLE_OPTIONS = [
  { value: "driver", label: "Driver" },
  { value: "appraiser", label: "Appraiser" },
  { value: "helper", label: "Helper" },
] as const;

const ACTIVE_STATUS_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
] as const;

const DAY_OF_WEEK_OPTIONS = DAYS_OF_WEEK.map((day) => ({
  value: day,
  label: day.charAt(0).toUpperCase() + day.slice(1),
}));

const SHARED_ACTIVE_ROUTE_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "id",
    label: "Record ID",
    operators: ["eq", "neq"],
    valueType: "text",
    placeholder: "Enter record id…",
  },
  {
    field: "name",
    label: "Name",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter name…",
  },
  {
    field: "date",
    label: "Date",
    operators: [...DATE_OPERATORS],
    valueType: "text",
    placeholder: "YYYY-MM-DD",
  },
  {
    field: "route.name",
    label: "Route assignment",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter route name…",
  },
  {
    field: "route.id",
    label: "Route ID",
    operators: ["eq", "neq"],
    valueType: "text",
    placeholder: "Enter route id…",
  },
  {
    field: "employees.name",
    label: "Crew member",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter crew name…",
  },
  {
    field: "employees.id",
    label: "Crew member ID",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter employee id…",
  },
  {
    field: "employees.role",
    label: "Crew role",
    operators: ["eq", "neq"],
    valueType: "select",
    options: [...CREW_ROLE_OPTIONS],
  },
  {
    field: "branch.code",
    label: "Branch code",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter branch code…",
  },
  {
    field: "branch.id",
    label: "Branch ID",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter branch id…",
  },
  {
    field: "branch.name",
    label: "Branch name",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter branch name…",
  },
  {
    field: "active",
    label: "Status",
    operators: ["eq", "neq"],
    valueType: "select",
    options: [...ACTIVE_STATUS_OPTIONS],
  },
  {
    field: "dayOfWeek",
    label: "Day of week",
    operators: ["eq", "neq", "in", "notIn"],
    valueType: "select",
    options: DAY_OF_WEEK_OPTIONS,
  },
  {
    field: "rate",
    label: "Rate",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter rate…",
  },
];

const DELIVERY_ONLY_ACTIVE_ROUTE_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  {
    field: "container.number",
    label: "Container number",
    operators: [...TEXT_OPERATORS],
    valueType: "text",
    placeholder: "Enter container number…",
  },
  {
    field: "container.id",
    label: "Container ID",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter container id…",
  },
  {
    field: "tripNumber",
    label: "Trip number",
    operators: [...NUMERIC_OPERATORS],
    valueType: "text",
    placeholder: "Enter trip number…",
  },
];

export function getActiveRouteTableFilterFields(
  routeType?: RouteType,
): TableFilterFieldDefinition[] {
  const shared = SHARED_ACTIVE_ROUTE_TABLE_FILTER_FIELDS.filter(
    (field) => field.field !== "active" && field.field !== "dayOfWeek",
  );
  if (routeType === "pickup") {
    return shared;
  }
  return [...shared, ...DELIVERY_ONLY_ACTIVE_ROUTE_TABLE_FILTER_FIELDS];
}

/** @deprecated Use getActiveRouteTableFilterFields(routeType) */
export const ACTIVE_ROUTE_TABLE_FILTER_FIELDS = getActiveRouteTableFilterFields("delivery");
