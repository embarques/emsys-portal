/**
 * POST /branches/search — OR bar search across common branch fields.
 * Only fields the API allows may appear here; unsupported fields
 * (address.country, settings.labelPrefix, disclaimer) cause an HTTP 400.
 */
export const BRANCH_BAR_OR_SEARCH_FIELDS = [
  "name",
  "code",
  "type",
  "phones.number",
  "address.city",
  "address.state",
  "address.zipcode",
] as const;

export type BranchBarOrSearchField = (typeof BRANCH_BAR_OR_SEARCH_FIELDS)[number];
