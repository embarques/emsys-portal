/**
 * POST /users/search — OR bar search across searchable user fields.
 *
 * The bar uses the `contains` operator, so only string fields belong here.
 * `accessCode` is numeric and lives in advanced filters only (the strict API
 * rejects string operators on numeric fields).
 */
export const USER_BAR_OR_SEARCH_FIELDS = [
  "userName",
  "fullName",
  "email",
  "uid",
  "type",
  "role.name",
  "branch.name",
  "branch.code",
] as const;

export type UserBarOrSearchField = (typeof USER_BAR_OR_SEARCH_FIELDS)[number];
