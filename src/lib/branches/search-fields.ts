/** POST /branches/search — OR bar search across common branch fields. */
export const BRANCH_BAR_OR_SEARCH_FIELDS = [
  "name",
  "code",
  "type",
  "phone1",
  "phone2",
  "address.city",
  "address.state",
  "address.country",
  "settings.labelPrefix",
] as const;

export type BranchBarOrSearchField = (typeof BRANCH_BAR_OR_SEARCH_FIELDS)[number];
