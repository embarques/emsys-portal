import {
  buildAdvancedSearchBody,
  buildResourceSearchFilterGroups,
  type ApiSearchFilter,
  type ApiSearchFilterNode,
} from "@/lib/api/search-query";
import { createTypedFilterExpander } from "@/lib/table/typed-filter-expander";
import type { TableFilterFieldDefinition } from "@/lib/table/filter-builder";
import type { JournalQueue } from "./journal-queue";
import type { DailyIncomeJournalListParams } from "./types";

/**
 * Pending Clearance only lists clearable activity. Voided/reversed journals can
 * still carry a stale OUTSTANDING clearanceStatus from the API, so exclude them
 * from the queue and badge count. They belong in reconciliation when outstanding.
 */
export const OUTSTANDING_CLEARANCE_FILTERS: ApiSearchFilter[] = [
  { field: "clearanceStatus", operator: "eq", value: "OUTSTANDING" },
  { field: "transactionStatus", operator: "notIn", value: ["VOIDED", "REVERSED"] },
];

export const OUTSTANDING_RECONCILIATION_FILTERS: ApiSearchFilter[] = [
  { field: "reconciliationStatus", operator: "eq", value: "OUTSTANDING" },
];

export function outstandingJournalQueueFilters(queue: JournalQueue): ApiSearchFilter[] {
  return queue === "clearance" ? OUTSTANDING_CLEARANCE_FILTERS : OUTSTANDING_RECONCILIATION_FILTERS;
}

const text: TableFilterFieldDefinition["operators"] = ["eq", "neq", "contains", "startsWith"];
const numeric: TableFilterFieldDefinition["operators"] = ["eq", "neq", "gte", "lte"];
export const DAILY_INCOME_TABLE_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  ...["invoice.number", "createdBy.name", "accounts.name", "employee.name", "paymentReference", "external_reference_number", "refNumber", "description"].map(field => ({field, label: field, operators: text, valueType: "text" as const})),
  ...["incomeStatement.id", "invoice.cost", "invoice.payment", "invoice.balance", "transactionAmount"].map(field => ({field, label: field, operators: numeric, valueType: "text" as const})),
  {field: "employee.id", label: "Employee ID", operators: text, valueType: "text"},
  {field: "date", label: "Date", operators: ["gte", "lte"], valueType: "text", placeholder: "YYYY-MM-DD"},
  {field: "dateRange", label: "Date range", operators: ["eq"], valueType: "range"},
  {field: "transactionType", label: "Transaction", operators: ["eq", "neq"], valueType: "select", options: ["INITIAL-PAYMENT", "PAYMENT", "SALES", "EXPENSE", "INVENTORY", "DISCOUNT", "SURCHARGE", "TRANSFER", "LOAN", "LOAN-PAYMENT"].map(value => ({value, label: value}))},
  {field: "paymentMethod.name", label: "Payment method", operators: ["eq", "neq"], valueType: "select", options: ["CASH", "CHECK", "ZELLE", "DEPOSIT", "CREDIT-CARD"].map(value => ({value, label: value}))},
  {field: "reconciliationStatus", label: "Reconciliation", operators: ["eq", "neq"], valueType: "select", options: ["NOT_REQUIRED", "OUTSTANDING", "RECONCILED"].map(value => ({value, label: value}))},
  {field: "clearanceStatus", label: "Clearance", operators: ["eq", "neq"], valueType: "select", options: ["NOT_REQUIRED", "OUTSTANDING", "CLEARED"].map(value => ({value, label: value}))},
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
    barOrSearchFields: ["invoice.number", "refNumber", "createdBy.name", "employee.name", "accounts.name", "paymentReference", "external_reference_number"],
    filterRows: params.filterRows,
    tableFilterFields: PENDING_JOURNAL_TABLE_FILTER_FIELDS,
    expandNode: expandJournalFilterNode,
  });
  return buildAdvancedSearchBody({
    page: params.page ?? 1, limit: params.limit ?? 40, sort: params.sort ?? "createdAt:desc",
    filters: [
      ...(params.incomeStatementId ? [{field: "incomeStatement.id", operator: "eq", value: params.incomeStatementId}] : []),
      ...(params.pending ? OUTSTANDING_RECONCILIATION_FILTERS : []),
      ...(params.pendingClearance ? OUTSTANDING_CLEARANCE_FILTERS : []),
    ],
    filterGroups: groups,
  });
}
