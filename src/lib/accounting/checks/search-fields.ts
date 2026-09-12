/** POST /checks/search — OR bar search across check fields. */
export const CHECK_BAR_OR_SEARCH_FIELDS = [
  "checkNumber",
  "invoice.number",
  "refNumber",
  "status",
  "createdBy.name",
] as const;

export type CheckBarOrSearchField = (typeof CHECK_BAR_OR_SEARCH_FIELDS)[number];
