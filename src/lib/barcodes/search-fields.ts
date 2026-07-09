/**
 * POST /barcodes/search — OR bar search across allowed barcode directory fields.
 *
 * Probed 2026-07-09: backend allows only these searchable fields (not status,
 * container, route, delivery, or tripNumber).
 */
export const BARCODE_BAR_OR_SEARCH_FIELDS = [
  "number",
  "id",
  "scanDate",
  "createdAt",
  "updatedAt",
  "createdBy.name",
  "updatedBy.name",
  "createdBy.id",
  "updatedBy.id",
] as const;

export type BarcodeBarOrSearchField = (typeof BARCODE_BAR_OR_SEARCH_FIELDS)[number];
