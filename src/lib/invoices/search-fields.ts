import {
  createOrTextSearchFilterGroup,
  type ApiSearchFilter,
  type ApiSearchFilterGroup,
} from "@/lib/api/search-query";

/**
 * Invoice directory search bar — POST /invoices/search OR + contains.
 * Comma-separated values search invoice numbers only (OR across each term).
 */
export const INVOICE_BAR_OR_SEARCH_FIELDS = [
  "number",
  "sender.name",
  "receiver.name",
  "sender.phone1",
  "receiver.phone1",
  "sender.address.city",
  "sender.address.state",
  "sender.address.zipcode",
  "receiver.address.city",
  "receiver.address.state",
  "receiver.address.zipcode",
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

  return createOrTextSearchFilterGroup(trimmed, [...INVOICE_BAR_OR_SEARCH_FIELDS], "contains");
}
