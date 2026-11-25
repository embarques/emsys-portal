/**
 * POST /branches/search — main search identifies branches by name or code.
 * Contact/address/type criteria stay in advanced filters. The label-prefix
 * advanced filter awaits deployment verification.
 */
export const BRANCH_BAR_OR_SEARCH_FIELDS = [
  "name",
  "code",
] as const;

export type BranchBarOrSearchField = (typeof BRANCH_BAR_OR_SEARCH_FIELDS)[number];
