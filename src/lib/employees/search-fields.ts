/** POST /employees/search — OR bar search across common employee fields. */
export const EMPLOYEE_BAR_OR_SEARCH_FIELDS = [
  "name",
  "title",
  "department",
  "email",
  "phones.number",
  "address.address1",
  "address.city",
] as const;

export type EmployeeBarOrSearchField = (typeof EMPLOYEE_BAR_OR_SEARCH_FIELDS)[number];
