/**
 * POST /roles/search — OR bar search across role fields.
 *
 * The free-text bar matches `contains` against the role name, the audit user
 * display names, and the stringified numeric `id`.
 */
export const ROLE_BAR_OR_SEARCH_FIELDS = [
  "name",
  "createdBy.name",
  "updatedBy.name",
  "id",
] as const;

export type RoleBarOrSearchField = (typeof ROLE_BAR_OR_SEARCH_FIELDS)[number];
