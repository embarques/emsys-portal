/**
 * POST /employees/search — OR bar search across searchable employee fields.
 *
 * Only fields the backend accepts are included. `address.address1`,
 * `address.address2`, `address.apartment`, `address.country`, and `branch.code`
 * return 400 ("search query validation failed"), and including any of them makes
 * the entire OR query fail — so the supported address fields are city/state/zipcode.
 */
export const EMPLOYEE_BAR_OR_SEARCH_FIELDS = [
  "name",
  "title",
  "department",
  "email",
  "phones.number",
  "address.city",
  "address.state",
  "address.zipcode",
] as const;

export type EmployeeBarOrSearchField = (typeof EMPLOYEE_BAR_OR_SEARCH_FIELDS)[number];
