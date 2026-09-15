import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for api-docs.json definitions["vehicle_route.VehicleRoute"]. */
export const ACTIVE_ROUTE_API_TABLE_FIELDS = [
  { field: "active" },
  { field: "appraiser", columnId: "appraiser.name" },
  { field: "branch", columnId: "branch.code" },
  { field: "container", columnId: "container.name" },
  { field: "date", format: "date" },
  { field: "dayOfWeek" },
  { field: "driver", columnId: "driver.name" },
  { field: "employees" },
  { field: "id" },
  { field: "name" },
  { field: "rate" },
  { field: "route", columnId: "route.name" },
  { field: "routeType" },
  { field: "tripNumber" },
  { field: "type" },
  { field: "vehicle", columnId: "vehicle.name" },
] as const satisfies readonly ApiTableField[];
