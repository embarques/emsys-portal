/** POST /containers/search — OR bar search across common container fields. */
export const CONTAINER_BAR_OR_SEARCH_FIELDS = [
  "name",
  "containerNumber",
  "booking",
  "sealNumber",
  "seal",
  "broker",
  "company",
] as const;

export type ContainerBarOrSearchField = (typeof CONTAINER_BAR_OR_SEARCH_FIELDS)[number];
