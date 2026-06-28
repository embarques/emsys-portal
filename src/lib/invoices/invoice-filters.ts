import {
  coerceTypedLeafFilter,
  isApiSearchFilter,
  type ApiSearchFilter,
  type ApiSearchFilterNode,
} from "@/lib/api/search-query";
import {
  mapPaymentLocationToPaidRegion,
  type InvoicePaymentLocation,
} from "@/lib/invoices/types";

const NUMERIC_FIELDS: ReadonlySet<string> = new Set([
  "cost",
  "discount",
  "payment",
  "balance",
  "surcharge",
  "employee.id",
  "sender.id",
  "receiver.id",
]);
const BOOLEAN_FIELDS: ReadonlySet<string> = new Set(["isArchive", "isVoid"]);

function parseRangeValue(raw: string): { start: string; end: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const separators = [" to ", "..", "–", "—"];
  for (const separator of separators) {
    if (trimmed.includes(separator)) {
      const [start, end] = trimmed.split(separator).map((part) => part.trim());
      if (start && end) return { start, end };
    }
  }

  const dashMatch = trimmed.match(/^(\S+)\s*-\s*(\S+)$/);
  if (dashMatch) {
    return { start: dashMatch[1], end: dashMatch[2] };
  }

  const commaParts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length === 2) {
    return { start: commaParts[0], end: commaParts[1] };
  }

  return null;
}

function expandDateRangeFilter(
  field: string,
  value: ApiSearchFilter["value"],
): ApiSearchFilterNode | null {
  const range = parseRangeValue(String(value));
  if (!range) return null;

  return {
    operator: "and",
    filters: [
      { field, operator: "gte", value: range.start },
      { field, operator: "lte", value: range.end },
    ],
  };
}

function expandPaidRegionFilter(filter: ApiSearchFilter): ApiSearchFilter {
  const raw = String(filter.value).trim().toLowerCase();
  if (raw === "usa" || raw === "dr") {
    return {
      ...filter,
      value: mapPaymentLocationToPaidRegion(raw as InvoicePaymentLocation),
    };
  }
  return filter;
}

function expandInvoiceLeafFilter(filter: ApiSearchFilter): ApiSearchFilterNode | null {
  switch (filter.field) {
    case "numberRange":
      return expandDateRangeFilter("number", filter.value);
    case "dateRange":
      return expandDateRangeFilter("date", filter.value);
    case "createdAtRange":
      return expandDateRangeFilter("createdAt", filter.value);
    case "updatedAtRange":
      return expandDateRangeFilter("updatedAt", filter.value);
    case "paidRegion":
      return expandPaidRegionFilter(filter);
    default:
      return coerceTypedLeafFilter(filter, {
        numericFields: NUMERIC_FIELDS,
        booleanFields: BOOLEAN_FIELDS,
      });
  }
}

export function expandInvoiceFilterNode(node: ApiSearchFilterNode): ApiSearchFilterNode | null {
  if (isApiSearchFilter(node)) {
    return expandInvoiceLeafFilter(node);
  }

  const filters = node.filters
    .map((entry) => expandInvoiceFilterNode(entry))
    .filter((entry): entry is ApiSearchFilterNode => entry != null);

  if (filters.length === 0) return null;

  return {
    operator: node.operator,
    filters,
  };
}
