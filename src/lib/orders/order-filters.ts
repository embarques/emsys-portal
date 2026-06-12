import {
  isApiSearchFilter,
  type ApiSearchFilter,
  type ApiSearchFilterNode,
} from "@/lib/api/search-query";

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

function expandZipRangeFilter(value: string | number | boolean): ApiSearchFilterNode | null {
  const range = parseRangeValue(String(value));
  if (!range) return null;

  return {
    operator: "and",
    filters: [
      { field: "sender.address.zipcode", operator: "gte", value: range.start },
      { field: "sender.address.zipcode", operator: "lte", value: range.end },
    ],
  };
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

function expandCompletedFilter(filter: ApiSearchFilter): ApiSearchFilter {
  const wantsCompleted = String(filter.value) === "true";

  if (filter.operator === "eq") {
    return wantsCompleted
      ? { field: "completed", operator: "eq", value: true }
      : { field: "completed", operator: "neq", value: true };
  }

  if (filter.operator === "neq") {
    return wantsCompleted
      ? { field: "completed", operator: "neq", value: true }
      : { field: "completed", operator: "eq", value: true };
  }

  return wantsCompleted
    ? { field: "completed", operator: "eq", value: true }
    : { field: "completed", operator: "neq", value: true };
}

function expandOrderLeafFilter(filter: ApiSearchFilter): ApiSearchFilterNode | null {
  switch (filter.field) {
    case "sender.zipRange":
      return expandZipRangeFilter(filter.value);
    case "dateRange":
      return expandDateRangeFilter("date", filter.value);
    case "createdAtRange":
      return expandDateRangeFilter("createdAt", filter.value);
    case "completed":
      return expandCompletedFilter(filter);
    default:
      return filter;
  }
}

export function expandOrderFilterNode(node: ApiSearchFilterNode): ApiSearchFilterNode | null {
  if (isApiSearchFilter(node)) {
    return expandOrderLeafFilter(node);
  }

  const filters = node.filters
    .map((entry) => expandOrderFilterNode(entry))
    .filter((entry): entry is ApiSearchFilterNode => entry != null);

  if (filters.length === 0) return null;

  return {
    operator: node.operator,
    filters,
  };
}
