/** POST /vehicles/search — vehicle identity fields; other criteria use advanced filters. */
export const VEHICLE_BAR_OR_SEARCH_FIELDS = [
  "vehicleId",
  "name",
  "licensePlate",
  "vin",
] as const;

export type VehicleBarOrSearchField = (typeof VEHICLE_BAR_OR_SEARCH_FIELDS)[number];
