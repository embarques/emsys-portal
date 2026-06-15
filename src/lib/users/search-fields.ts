/** POST /users/search — OR bar search across common user fields. */
export const USER_BAR_OR_SEARCH_FIELDS = [
  "userName",
  "fullName",
  "email",
  "uid",
  "type",
  "role.name",
] as const;

export type UserBarOrSearchField = (typeof USER_BAR_OR_SEARCH_FIELDS)[number];
