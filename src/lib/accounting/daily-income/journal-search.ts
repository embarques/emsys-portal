import { buildAdvancedSearchBody, buildResourceSearchFilterGroups, type ApiSearchFilterNode } from "@/lib/api/search-query";
import { createTypedFilterExpander } from "@/lib/table/typed-filter-expander";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";
import type { DailyIncomeJournalListParams } from "./types";

const text: TableFilterFieldDefinition["operators"] = ["eq", "neq", "contains", "startsWith"];
const numeric: TableFilterFieldDefinition["operators"] = ["eq", "neq", "gte", "lte"];
export const DAILY_INCOME_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  ...["invoice.number", "createdBy.name", "accounts.name", "employee.name", "paymentReference", "external_reference_number", "refNumber"].map(field => ({field, label: field, operators: text, valueType: "text" as const})),
  ...["incomeStatement.id", "invoice.cost", "invoice.payment", "invoice.balance", "transactionAmount"].map(field => ({field, label: field, operators: numeric, valueType: "text" as const})),
  {field: "employee.id", label: "Employee ID", operators: text, valueType: "text"},
  {field: "date", label: "Date", operators: ["gte", "lte"], valueType: "text", placeholder: "YYYY-MM-DD"},
  {field: "dateRange", label: "Date range", operators: ["eq"], valueType: "range"},
  {field: "transactionType", label: "Transaction", operators: ["eq", "neq"], valueType: "select", options: ["INITIAL-PAYMENT", "PAYMENT", "SALES", "EXPENSE", "INVENTORY", "DISCOUNT", "SURCHARGE", "TRANSFER", "LOAN"].map(value => ({value, label: value}))},
  {field: "paymentMethod.name", label: "Payment method", operators: ["eq", "neq"], valueType: "select", options: ["CASH", "CHECK", "ZELLE", "DEPOSIT", "CREDIT-CARD"].map(value => ({value, label: value}))},
  {field: "reconciliationStatus", label: "Reconciliation", operators: ["eq", "neq"], valueType: "select", options: ["OUTSTANDING", "RECONCILED"].map(value => ({value, label: value}))},
];
export const PENDING_JOURNAL_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  ...DAILY_INCOME_TABLE_FILTER_FIELDS,
  {field: "branch.id", label: "Branch ID", operators: ["eq"], valueType: "text"},
];
const expandTypedJournalFilterNode = createTypedFilterExpander({
  numericFields: ["incomeStatement.id", "invoice.cost", "invoice.payment", "invoice.balance", "transactionAmount", "branch.id"],
  rangeFields: {dateRange: "date"},
});
export function expandJournalFilterNode(node: ApiSearchFilterNode): ApiSearchFilterNode | null {
  if ("filters" in node) {
    const filters = node.filters.map(expandJournalFilterNode).filter((entry): entry is ApiSearchFilterNode => entry != null);
    return filters.length ? {...node, filters} : null;
  }
  // Numeric equality uses a JSON number; text operators search its string form.
  if (node.field === "employee.id" && (node.operator === "eq" || node.operator === "neq")) {
    const value = Number(node.value);
    return Number.isFinite(value) ? {...node, value} : null;
  }
  return expandTypedJournalFilterNode(node);
}
export function buildJournalSearchBody(params: DailyIncomeJournalListParams) {
  const groups = buildResourceSearchFilterGroups({
    search: params.query ? {value: params.query} : undefined,
    barOrSearchFields: ["invoice.number", "refNumber", "createdBy.name", "employee.name"],
    filterRows: params.filterRows,
    tableFilterFields: PENDING_JOURNAL_TABLE_FILTER_FIELDS,
    expandNode: expandJournalFilterNode,
  });
  return buildAdvancedSearchBody({
    page: params.page ?? 1, limit: params.limit ?? 40, sort: params.sort ?? "createdAt:desc",
    filters: [
      ...(params.incomeStatementId ? [{field: "incomeStatement.id", operator: "eq", value: params.incomeStatementId}] : []),
      ...(params.pending ? [{field: "reconciliationStatus", operator: "eq", value: "OUTSTANDING"}] : []),
    ],
    filterGroups: groups,
  });
}
