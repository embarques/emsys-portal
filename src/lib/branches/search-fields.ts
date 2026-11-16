/**
 * POST /branches/search — main search identifies branches by name or code.
 * Contact/address/type criteria stay in advanced filters. Missing backend
 * capabilities such as settings.labelPrefix remain blocked separately.
 */
export const BRANCH_BAR_OR_SEARCH_FIELDS = [
  "name",
  "code",
] as const;

export type BranchBarOrSearchField = (typeof BRANCH_BAR_OR_SEARCH_FIELDS)[number];
