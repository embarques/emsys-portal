/**
 * POST /users/search — OR bar search across searchable user fields.
 *
 * The bar uses the `contains` operator, so only string fields belong here.
 * Only fields supported by the current user API belong here.
 */
export const USER_BAR_OR_SEARCH_FIELDS = [
  "name",
  "email",
  "uid",
  "role.name",
  "branch.name",
] as const;

export type UserBarOrSearchField = (typeof USER_BAR_OR_SEARCH_FIELDS)[number];
