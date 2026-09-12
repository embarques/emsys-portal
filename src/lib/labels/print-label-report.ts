import type { ReportRequest } from "@/lib/reports/types";

/**
 * Build a selected-label print request.
 *
 * Uses ObjectID `barcodeId` values with `collection=barcodes` + `lookup_field=id`
 * so duplicate barcode numbers / package sequences cannot broaden the PDF.
 * Numeric ids are accepted only as legacy fallback values in `barcodeIds`.
 */
export function buildSelectedLabelReportRequest(
  barcodeIds: string[],
  expiresInHours = 24,
): ReportRequest {
  return {
    type: "label",
    collection: "barcodes",
    values: barcodeIds,
    lookupField: "id",
    expiresInHours,
  };
}
