import {
  buildResourceSearchFilterGroups,
  buildStripeStyleSearchBody,
  type ApiSearchFilterNode,
} from "@/lib/api/search-query";
import type { TableFilterFieldDefinition, TableFilterRowState } from "@/lib/table/filter-types";

export const INVOICE_POOL_FILTER_FIELDS: TableFilterFieldDefinition[] = [
  { field: "number", label: "Invoice number", operators: ["contains", "eq", "neq", "startsWith"], valueType: "text" },
  { field: "receivedAt", label: "Received at", operators: ["eq", "neq", "gte", "lte"], valueType: "text", placeholder: "YYYY-MM-DD" },
  { field: "allocation.userId", label: "User", operators: ["eq", "neq"], valueType: "select", optionsSource: "users" },
  { field: "status", label: "Status", operators: ["eq", "neq"], valueType: "select", options: [
    { value: "available", label: "Available" },
    { value: "assigned", label: "Assigned · awaiting download" },
    { value: "downloaded", label: "Downloaded to mobile" },
  ] },
];

function expandPoolFilter(node: ApiSearchFilterNode): ApiSearchFilterNode {
  if ("filters" in node) return { ...node, filters: node.filters.map(expandPoolFilter) };
  if (node.field === "allocation.userId") return { ...node, value: Number(node.value) };
  if (node.field !== "status") return node;

  const negated = node.operator === "neq";
  if (node.value === "downloaded") return { field: "claimed", operator: "eq", value: !negated };
  // Status mirrors the table: claimed numbers are always downloaded, regardless of assignee.
  return {
    operator: negated ? "or" : "and",
    filters: [
      { field: "claimed", operator: "eq", value: negated },
      { field: "allocation.userId", operator: (node.value === "available") !== negated ? "eq" : "neq", value: 0 },
    ],
  };
}

export function buildInvoicePoolSearchBody(rows: TableFilterRowState[], search?: string) {
  return buildStripeStyleSearchBody({ filterGroups: buildResourceSearchFilterGroups({
    search: search?.trim() ? { value: search.trim() } : undefined,
    barOrSearchFields: ["number"],
    filterRows: rows,
    tableFilterFields: INVOICE_POOL_FILTER_FIELDS,
    expandNode: expandPoolFilter,
  }) });
}
