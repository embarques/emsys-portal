/** POST /user-activities/search — OR bar search across activity fields. */
export const USER_ACTIVITY_BAR_OR_SEARCH_FIELDS = [
  "description",
  "origin",
  "id",
  "user.name",
  "severity",
] as const;

export type UserActivityBarOrSearchField = (typeof USER_ACTIVITY_BAR_OR_SEARCH_FIELDS)[number];
