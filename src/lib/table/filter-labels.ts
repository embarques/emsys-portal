import type { TranslateFn } from "@/lib/feedback/messages";

import type { TableFilterOperator, TableFilterRowJoin } from "./filter-types";

export function getFilterOperatorLabels(t: TranslateFn): Record<TableFilterOperator, string> {
  return {
    eq: t("common.filterOperators.eq"),
    neq: t("common.filterOperators.neq"),
    contains: t("common.filterOperators.contains"),
    startsWith: t("common.filterOperators.startsWith"),
    in: t("common.filterOperators.in"),
    notIn: t("common.filterOperators.notIn"),
    gt: t("common.filterOperators.gt"),
    gte: t("common.filterOperators.gte"),
    lt: t("common.filterOperators.lt"),
    lte: t("common.filterOperators.lte"),
  };
}

export function getTableFilterJoinOptions(
  t: TranslateFn,
): { value: TableFilterRowJoin; label: string }[] {
  return [
    { value: "and", label: t("common.filterOperators.and") },
    { value: "or", label: t("common.filterOperators.or") },
  ];
}

/** @deprecated Use getFilterOperatorLabels(t) in components instead. */
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

/** @deprecated Use getTableFilterJoinOptions(t) in components instead. */
export const TABLE_FILTER_JOIN_OPTIONS: { value: TableFilterRowJoin; label: string }[] = [
  { value: "and", label: "AND" },
  { value: "or", label: "OR" },
];
