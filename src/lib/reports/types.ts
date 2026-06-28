/** Document types supported by the `/reports/*` endpoints. */
export type ReportType = "income" | "invoice" | "journal" | "label" | "pickup";

/** Collections the `values` identifiers can be resolved against. */
export type ReportCollection =
  | "income"
  | "invoices"
  | "journals"
  | "barcodes"
  | "pickups";

/**
 * Shared payload structure accepted by every `POST /reports/*` endpoint.
 *
 * Examples:
 * - Invoice by object id (`/reports/invoices`):
 *   `{ type: "invoice", collection: "invoices", values: ["6a32..."], lookupField: "id" }`
 * - Labels by invoice number (`/reports/labels`):
 *   `{ type: "label", collection: "invoices", values: ["489391"], lookupField: "number" }`
 * - Labels by barcode number (`/reports/labels`):
 *   `{ type: "label", collection: "barcodes", values: ["ET045260333"], lookupField: "number" }`
 * - Pickup manifest (`/reports/pickups`):
 *   `{ type: "pickup", collection: "pickups", values: ["42"], lookupField: "id" }`
 */
export type ReportRequest = {
  /** Document type to render. */
  type: ReportType;
  /** Collection the `values` identifiers belong to. */
  collection: ReportCollection;
  /** Identifiers to resolve and render. */
  values: string[];
  /** Field the API uses to resolve `values` (defaults to `id`). */
  lookupField?: string;
  /** How long the returned public URL stays valid (defaults to 24). */
  expiresInHours?: number;
};

/** Normalized result returned by the `POST /reports/*` endpoints. */
export type ReportResult = {
  /** Temporary public URL pointing at the generated PDF. */
  url: string;
  /** Identifier of the generated report, when provided. */
  reportId: string;
  /** Generated PDF file name, when provided. */
  fileName: string;
  /** ISO timestamp marking when the public URL stops working, when provided. */
  expiresAt: string;
};
