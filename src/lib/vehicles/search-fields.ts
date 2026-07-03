/** POST /vehicles/search — OR bar search across common vehicle fields. */
export const VEHICLE_BAR_OR_SEARCH_FIELDS = [
  "vehicleId",
  "name",
  "vin",
  "licensePlate",
  "fuelType",
  "branch.code",
  "createdBy.name",
] as const;

export type VehicleBarOrSearchField = (typeof VEHICLE_BAR_OR_SEARCH_FIELDS)[number];
