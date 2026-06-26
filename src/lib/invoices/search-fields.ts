import {
  createOrTextSearchFilterGroup,
  type ApiSearchFilter,
  type ApiSearchFilterGroup,
} from "@/lib/api/search-query";

/**
 * Invoice directory search bar — POST /invoices/search OR + contains.
 * Pagination in URL; body is filters + sort only (same as customers/trucks).
 * Only the fields the EMSYS /invoices/search endpoint allows may be used here;
 * phone and address fields are rejected by the API.
 */
export const INVOICE_BAR_OR_SEARCH_FIELDS = [
  "number",
  "sender.name",
  "receiver.name",
  "container.name",
  "container.containerNumber",
] as const;

export type InvoiceBarOrSearchField = (typeof INVOICE_BAR_OR_SEARCH_FIELDS)[number];

export function parseInvoiceSearchCommaTerms(value: string): string[] | null {
  const trimmed = value.trim();
  if (!trimmed.includes(",")) return null;

  const terms = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return terms.length > 0 ? terms : null;
}

export function createInvoiceBarSearchFilterGroup(value: string): ApiSearchFilterGroup | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const commaTerms = parseInvoiceSearchCommaTerms(trimmed);
  if (commaTerms) {
    const filters: ApiSearchFilter[] = commaTerms.map((term) => ({
      field: "number",
      operator: "contains",
      value: term,
    }));

    return { operator: "or", filters };
  }

  const searchFields = /\d/.test(trimmed)
    ? [...INVOICE_BAR_OR_SEARCH_FIELDS]
    : INVOICE_BAR_OR_SEARCH_FIELDS.filter((field) => field !== "number");

  return createOrTextSearchFilterGroup(trimmed, searchFields, "contains");
}
