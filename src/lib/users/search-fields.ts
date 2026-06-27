/**
 * POST /users/search — OR bar search across searchable user fields.
 *
 * `branch.code` and `accessCode` return 400 ("search query validation failed")
 * and are excluded; `branch.name` is supported and included.
 */
export const USER_BAR_OR_SEARCH_FIELDS = [
  "userName",
  "fullName",
  "email",
  "uid",
  "type",
  "role.name",
  "branch.name",
] as const;

export type UserBarOrSearchField = (typeof USER_BAR_OR_SEARCH_FIELDS)[number];
