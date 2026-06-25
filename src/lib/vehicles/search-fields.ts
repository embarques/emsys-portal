/** POST /vehicles/search — OR bar search across common vehicle fields. */
export const VEHICLE_BAR_OR_SEARCH_FIELDS = [
  "vehicleId",
  "name",
  "vin",
  "fuelType",
  "branch",
  "createdBy",
] as const;

export type VehicleBarOrSearchField = (typeof VEHICLE_BAR_OR_SEARCH_FIELDS)[number];
