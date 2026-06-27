/**
 * POST /containers/search — OR bar search across every container field.
 *
 * The backend accepts `contains` against all fields (numeric `id`/`cost` and the
 * date fields match as stringified values), so the free-text bar searches them all.
 */
export const CONTAINER_BAR_OR_SEARCH_FIELDS = [
  "name",
  "containerNumber",
  "booking",
  "sealNumber",
  "seal",
  "broker",
  "company",
  "id",
  "cost",
  "departureDate",
  "arrivalDate",
] as const;

export type ContainerBarOrSearchField = (typeof CONTAINER_BAR_OR_SEARCH_FIELDS)[number];
