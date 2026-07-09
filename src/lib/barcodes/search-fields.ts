/**
 * POST /barcodes/search — OR bar search across barcode directory fields.
 */
export const BARCODE_BAR_OR_SEARCH_FIELDS = [
  "number",
  "id",
  "status.name",
  "container.name",
  "scanDate",
] as const;

export type BarcodeBarOrSearchField = (typeof BARCODE_BAR_OR_SEARCH_FIELDS)[number];
