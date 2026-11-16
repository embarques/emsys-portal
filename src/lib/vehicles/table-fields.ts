import type { ApiTableField } from "@/lib/table/api-table-fields";

/** Directory coverage for .reference/emsys-api/docs/swagger.json definitions["vehicle.Vehicle"]. */
export const VEHICLE_API_TABLE_FIELDS = [
  { field: "active" },
  { field: "branch" },
  { field: "createdAt", format: "date" },
  { field: "createdBy" },
  { field: "fuelType" },
  { field: "id" },
  { field: "inspectionDate", format: "date" },
  { field: "licensePlate" },
  { field: "name" },
  { field: "registrationDate", format: "date" },
  { field: "updatedAt", format: "date" },
  { field: "updatedBy" },
  { field: "vehicleId" },
  { field: "vin" },
  { field: "year" },
] as const satisfies readonly ApiTableField[];
