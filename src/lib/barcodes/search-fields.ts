/**
 * POST /barcodes/search — OR bar search across barcode directory fields.
 *
 * Includes merchandise fields (invoice, description, container, status, route).
 * If the API rejects a nested field, remove it from this list after probing.
 */
export const BARCODE_BAR_OR_SEARCH_FIELDS = [
  "number",
  "description",
  "invoice.number",
  "invoiceNumber",
  "container.name",
  "status.name",
  "route.name",
  "id",
  "scanDate",
  "createdAt",
  "updatedAt",
  "createdBy.name",
  "updatedBy.name",
] as const;

export type BarcodeBarOrSearchField = (typeof BARCODE_BAR_OR_SEARCH_FIELDS)[number];
