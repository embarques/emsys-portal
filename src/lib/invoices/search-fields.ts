import {
  createOrTextSearchFilterGroup,
  type ApiSearchFilter,
  type ApiSearchFilterGroup,
} from "@/lib/api/search-query";

/**
 * Invoice directory search bar — POST /invoices/search OR + contains.
 * Pagination in URL; body is filters + sort only (same as customers/vehicles).
 * Phone searches include normalized phones and legacy phone1 snapshots.
 */
export const INVOICE_BAR_OR_SEARCH_FIELDS = [
  "number",
  "sender.name",
  "sender.phones.number",
  "sender.phone1",
  "receiver.name",
  "receiver.phones.number",
  "receiver.phone1",
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
    : INVOICE_BAR_OR_SEARCH_FIELDS.filter(
        (field) => field !== "number" && !field.includes("phone"),
      );

  return createOrTextSearchFilterGroup(trimmed, searchFields, "contains");
}
