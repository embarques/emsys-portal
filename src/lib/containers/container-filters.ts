import {
  coerceTypedLeafFilter,
  isApiSearchFilter,
  type ApiSearchFilter,
  type ApiSearchFilterNode,
} from "@/lib/api/search-query";

const NUMERIC_FIELDS: ReadonlySet<string> = new Set(["id", "cost"]);

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
  value: string | number | boolean,
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

function expandContainerLeafFilter(filter: ApiSearchFilter): ApiSearchFilterNode | null {
  switch (filter.field) {
    case "departureDateRange":
      return expandDateRangeFilter("departureDate", filter.value);
    case "arrivalDateRange":
      return expandDateRangeFilter("arrivalDate", filter.value);
    default:
      return coerceTypedLeafFilter(filter, { numericFields: NUMERIC_FIELDS });
  }
}

export function expandContainerFilterNode(node: ApiSearchFilterNode): ApiSearchFilterNode | null {
  if (isApiSearchFilter(node)) {
    return expandContainerLeafFilter(node);
  }

  const filters = node.filters
    .map((entry) => expandContainerFilterNode(entry))
    .filter((entry): entry is ApiSearchFilterNode => entry != null);

  if (filters.length === 0) return null;

  return {
    operator: node.operator,
    filters,
  };
}
