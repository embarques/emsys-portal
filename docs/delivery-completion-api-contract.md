# Delivery completion wizard

The Deliver button in Routes → Deliveries opens four steps: items, photos, actual receiver/signature, confirmation. The layout adapts to phone, tablet and desktop. Existing signature capture and invoice signature printing are reused; no PDF preview is requested.

## Assignment and status identity

Assignment is numeric `barcode.delivery.id`, not the DR daily route ID. The list is visible to every authenticated user with delivery-view permission in the tenant; it does not require an employee link or crew membership. Route-only assignments are included even without numeric `delivery.id`. Tenant isolation and endpoint permissions remain required. Review and completion use endpoint permissions, without employee links or crew membership. Invoice membership in the numeric delivery and matching container are still validated; listing a route-only barcode does not invent a numeric delivery ID.

Status IDs are authoritative: pending **6** (currently CONDUCE), delivered **7** (currently ENTREGADO). Names and `prevStatus` text are never used to decide eligibility or transitions. Review returns the current catalog labels. Selected pieces become ID 7; unselected pieces stay ID 6 for the next trip. Invoice financial totals and the overall delivery status are unchanged.

## Endpoints

- `GET /v1/deliveries/assigned-barcodes` and `POST /v1/deliveries/assigned-barcodes/search`: delivery view permission; all tenant pending pieces, without employee/crew filtering. Page limit 100. Default province/invoice/barcode order. Filtering, sorting, pagination and counts run in the database. Receiver list metadata excludes personal ID and signature images.
- `GET /v1/deliveries/{deliveryId}/invoices/{invoiceId}/items`: delivery update + invoice view; no crew membership required. Returns invoice/delivery identity, receiver, container, pending pieces and `pendingStatus`/`deliveredStatus`. Maximum 200 pending pieces per invoice/delivery; larger assignments must be split before collecting a receipt.
- `POST /v1/deliveries/{deliveryId}/invoices/{invoiceId}/complete`: delivery update + invoice update; no crew membership required. Atomic completion described below.
- Existing `PUT /v1/deliveries/{deliveryId}/invoices/{invoiceId}/receiver/signature` remains available for standalone signature capture. The wizard uses the atomic completion endpoint, not a sequence of independent signature/status updates.

Completion body (replace all sample IDs and image data):

```json
{
  "requestId": "1331d28d-846d-42f4-8c99-a828d8f482ae",
  "barcodeIds": ["68f800000000000000000011"],
  "documentIds": ["68f800000000000000000021"],
  "policyIds": [1],
  "agreed": true,
  "receiverSignature": {
    "signerName": "Pedro Ramirez",
    "idNumber": "001-1234567-8",
    "contentType": "image/png",
    "data": "<complete raw base64 image>"
  }
}
```

The receiver ID belongs to the actual signer, independently of the invoice customer. The API supplies signing time, collector and receipt ID. Active policy IDs must match current policy records; agreement is required when policies exist. Send 1–200 unique item references in total: canonical ObjectIDs in `barcodeIds`, or existing positive numeric IDs in optional `legacyBarcodeIds` for older embedded pieces without a canonical barcodeId. Review returns `legacyId` alongside the barcode identity. Do not send a zero ObjectID. Send these item references and optionally up to 12 unique uploaded image document IDs (omit documentIds or send an empty array when there are no photos). All must belong to this invoice/delivery; images must have been uploaded by the collecting user. Completion updates embedded pieces and barcode catalog, associates photos, saves the private receipt and writes activity in one transaction. Missing/stale source records or canonical catalog mirrors fail closed with 409; nothing partially commits. Legacy pieces may predate the catalog: they update the invoice-owned piece and any existing numeric catalog mirror. Existing mirrors must match invoice, delivery and pending status or the transaction rolls back. No identifiers are invented and no background data migration runs.

Use the same UUID and exact payload after an uncertain response. Identical retries return the original receipt; a changed payload under that UUID returns 409. The portal retains uploaded photos, reloads pending items and requires a fresh signature after a definitive conflict.

Response data contains only `invoiceId`, numeric `deliveryId`, `signatureId`, and `deliveredCount`. Signature image bytes are never included in read or completion responses. Existing receipt limits (100 receipts / 8 MiB encoded receipt data per invoice) still apply.

## Photos and printing

Upload through `POST /v1/invoices/{invoiceId}/documents` multipart `file`, with optional stable UUID `uploadId` per photo. Existing clients may omit it. Identical upload retries return the existing document; conflicting reuse returns 409. Upload identity/hash remain private. Original image bytes are preserved and the existing 25 MiB per-file limit applies. Photos are optional; Continue proceeds directly to signature when none are selected. The wizard uses a unique filename and upload UUID, avoiding attachment-directory scans and sequence allocation.

Successful uploads are retained when a later upload or completion fails. Cancelling or removing a photo from the wizard does not delete an already uploaded invoice attachment. Completion links only selected uploaded photos. Camera/gallery controls accept images, with local thumbnail previews. Uploads are sequential and bounded to 12.

After success, Print uses the existing metadata-only signature picker, initially choosing the latest receipt for this numeric delivery. Users may select another receipt or sender-only. Signature images and actual signer ID are loaded only server-side for PDF generation.

## Rollout and validation

Deploy the API before the Portal. Existing tenant startup calls `EnsureIndexes`; restart successfully to install the numeric status/delivery source index and partial unique `(invoiceId, uploadId)` attachment index. No new permission names or production data migration is required. Both status catalog records 6 and 7 must exist. No production data was modified during implementation.

Isolated local MongoDB regression fixtures cover partial completion, replay/concurrency, rollback, foreign photos/deliveries, permission/tenant scope and completion without employee links or crew membership and renamed status labels. A representative fixture with 2,003 detail rows verifies a bounded 25-row page, two database commands and use of the numeric status/delivery index. Legacy/mixed identifier completion, retry, foreign-delivery and stale-mirror rollback are covered by isolated tests. See the PR validation for the measured local result; this is not a production latency guarantee.
