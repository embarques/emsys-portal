/**
 * POST /containers/search — OR across the selected text identity fields.
 * Amounts, numeric IDs and dates use typed advanced filters, never text contains.
 * Broker, company and the legacy seal field remain available as advanced filters.
 */
export const CONTAINER_BAR_OR_SEARCH_FIELDS = [
  "name",
  "containerNumber",
  "booking",
  "sealNumber",
  "itn",
] as const;

export type ContainerBarOrSearchField = (typeof CONTAINER_BAR_OR_SEARCH_FIELDS)[number];
