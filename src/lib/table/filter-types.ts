export type TableFilterOperator =
  | "eq"
  | "neq"
  | "contains"
  | "startsWith"
  | "in"
  | "notIn"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export type TableFilterRowJoin = "and" | "or";

export type TableFilterRowState = {
  id: string;
  /** How this row combines with prior complete filters. Ignored for the first row. */
  join: TableFilterRowJoin;
  field: string;
  operator: string;
  value: string;
};

export type TableFilterFieldOption = {
  value: string;
  label: string;
};

export type TableFilterFieldDefinition = {
  field: string;
  label: string;
  operators: TableFilterOperator[];
  valueType: "text" | "select" | "range";
  options?: TableFilterFieldOption[];
  /** Load options from workspace context (e.g. branches from API). */
  optionsSource?: string;
  placeholder?: string;
  /** When set, the row expands to an OR group across these API fields. */
  queryFields?: string[];
};

export const FILTER_OPERATOR_LABELS: Record<TableFilterOperator, string> = {
  eq: "Equals",
  neq: "Not equals",
  contains: "Contains",
  startsWith: "Starts with",
  in: "In",
  notIn: "Not in",
  gt: "Greater than",
  gte: "Greater than or equal",
  lt: "Less than",
  lte: "Less than or equal",
};

export const TABLE_FILTER_JOIN_OPTIONS: { value: TableFilterRowJoin; label: string }[] = [
  { value: "and", label: "AND" },
  { value: "or", label: "OR" },
];
