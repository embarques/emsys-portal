import { buildAdvancedSearchBody, buildResourceSearchFilterGroups, coerceTypedFilterNode, type ApiSearchFilterNode } from "@/lib/api/search-query";
import { DAILY_INCOME_TABLE_FILTER_FIELDS } from "../daily-income/filter-fields";
import { parseTableFilterRange } from "@/lib/table/filter-range";
import type { TableFilterRowState, TableFilterFieldDefinition } from "@/lib/table/filter-types";

function expandRanges(node: ApiSearchFilterNode): ApiSearchFilterNode {
  if ("filters" in node) return { ...node, filters: node.filters.map(expandRanges) };
  if (node.field !== "dateRange") return node;
  const range = parseTableFilterRange(String(node.value));
  if (!range) throw new Error("Invalid date range");
  return { operator: "and", filters: [
    { field: "date", operator: "gte", value: range.start },
    { field: "date", operator: "lte", value: range.end },
  ] };
}

// Proposed contract: docs/pending-transactions-update.md. Requires backend deployment.
export const PENDING_TRANSACTION_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  ...DAILY_INCOME_TABLE_FILTER_FIELDS,
  { field: "branch.id", label: "Branch ID", operators: ["eq"], valueType: "text" as const },
];
const numericFields = new Set(["branch.id", "incomeStatement.id", "invoice.cost", "invoice.payment", "invoice.balance", "transactionAmount"]);
export function pendingTransactionSearch(query: string, rows: TableFilterRowState[], page: number) {
  const groups = buildResourceSearchFilterGroups({
    search: { value: query },
    barOrSearchFields: ["invoice.number", "refNumber", "employee.name", "createdBy.name", "accounts.name", "external_reference_number", "paymentReference"],
    filterRows: rows,
    tableFilterFields: PENDING_TRANSACTION_FILTER_FIELDS,
    expandNode: expandRanges,
    chipFilters: [{ field: "reconciliationStatus", operator: "eq", value: "OUTSTANDING" }],
  });
  const body = buildAdvancedSearchBody({ page, limit: 40, sort: "date:desc", filterGroups: groups });
  return { ...body, filters: body.filters.flatMap(node => { const typed = coerceTypedFilterNode(node, { numericFields }); return typed ? [typed] : []; }) };
}
