/** POST /trucks/search — OR bar search across common truck fields. */
export const TRUCK_BAR_OR_SEARCH_FIELDS = [
  "truckId",
  "name",
  "vin",
  "fuelType",
  "branch",
  "createdBy",
] as const;

export type TruckBarOrSearchField = (typeof TRUCK_BAR_OR_SEARCH_FIELDS)[number];
