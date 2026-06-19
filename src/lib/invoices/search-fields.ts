import {
  createOrTextSearchFilterGroup,
  type ApiSearchFilter,
  type ApiSearchFilterGroup,
} from "@/lib/api/search-query";

/**
 * Invoice directory search bar — POST /invoices/search OR + contains.
 * Pagination in URL; body is filters + sort only (same as customers/trucks).
 * Invoice parties expose name + address only (no phone fields on the API model).
 */
export const INVOICE_BAR_OR_SEARCH_FIELDS = [
  "number",
  "sender.name",
  "receiver.name",
  "sender.address.address1",
  "sender.address.address2",
  "receiver.address.address1",
  "receiver.address.address2",
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