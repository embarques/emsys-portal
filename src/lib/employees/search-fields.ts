/**
 * POST /employees/search — OR bar search across searchable employee string fields.
 *
 * The bar uses the `contains` operator, so all listed fields must be strings.
 */
export const EMPLOYEE_BAR_OR_SEARCH_FIELDS = [
  "name",
  "title",
  "department",
  "email",
  "phones.number",
  "address.address1",
  "address.address2",
  "address.apartment",
  "address.city",
  "address.state",
  "address.zipcode",
  "address.country",
  "branch.code",
] as const;

export type EmployeeBarOrSearchField = (typeof EMPLOYEE_BAR_OR_SEARCH_FIELDS)[number];
