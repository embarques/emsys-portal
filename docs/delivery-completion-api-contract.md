# Delivery completion wizard

The Deliver button in Routes → Deliveries opens five steps: balance, items, photos, actual receiver/signature, confirmation. The layout adapts to phone, tablet and desktop. Existing signature capture and invoice signature printing are reused; no PDF preview is requested.

## Assignment and status identity

Assignment is numeric `barcode.delivery.id`, not the DR daily route ID. The list is visible to every authenticated user with delivery-view permission in the tenant; it does not require an employee link or crew membership. Route-only assignments are included even without numeric `delivery.id`. Tenant isolation and endpoint permissions remain required. Review and completion use endpoint permissions, without employee links or crew membership. Invoice membership in the numeric delivery and matching container are still validated; listing a route-only barcode does not invent a numeric delivery ID.

Status IDs are authoritative: pending **6** (currently CONDUCE), delivered **7** (currently ENTREGADO). Names and `prevStatus` text are never used to decide eligibility or transitions. Review returns the current catalog labels. Selected pieces become ID 7; unselected pieces stay ID 6 for the next trip. Invoice financial totals and the overall delivery status are unchanged.

## Endpoints

- `GET /v1/deliveries/assigned-barcodes` and `POST /v1/deliveries/assigned-barcodes/search`: delivery view permission; all tenant pending pieces, without employee/crew filtering. Page limit 100. Default province/invoice/barcode order. Filtering, sorting, pagination and counts run in the database. Receiver list metadata excludes personal ID and signature images. Each row's `invoice` object must also include the invoice's current open `balance` (number, same value as the invoices list `balance`) so the Deliveries table can show it without per-invoice requests; the portal leaves the cell blank when it is absent. Each row must also include the invoice `sender` with `name` and `phones` (same phone shape as `receiver.phones`); sender address and personal ID are not needed. Missing sender leaves the sender columns blank. Each row's `route` should also include the daily route `rate` (DOP per USD, number) so the balance can be shown in DOP without extra requests; when it is absent the portal reads `GET /v1/vehicle-routes/{route.id}` once per route for users with `vehicle_route` view, otherwise only USD is shown.
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

On mobile, the signature picker fills the screen and offers a Back to deliveries button. The completed wizard yields to the picker; cancelling or completing printing returns to Deliveries. Print reserves its PDF tab synchronously from the user action, before requesting the report. A blocked/closed tab leaves the panel open with an explicit Open PDF link; generation failures keep the selection and close the empty tab.

After success, Print uses the existing metadata-only signature picker, initially choosing the latest receipt for this numeric delivery. Users may select another receipt or sender-only. Signature images and actual signer ID are loaded only server-side for PDF generation.

## Rollout and validation

Deploy the API before the Portal. Existing tenant startup calls `EnsureIndexes`; restart successfully to install the numeric status/delivery source index and partial unique `(invoiceId, uploadId)` attachment index. No new permission names or production data migration is required. Both status catalog records 6 and 7 must exist. No production data was modified during implementation.

Isolated local MongoDB regression fixtures cover partial completion, replay/concurrency, rollback, foreign photos/deliveries, permission/tenant scope and completion without employee links or crew membership and renamed status labels. A representative fixture with 2,003 detail rows verifies a bounded 25-row page, two database commands and use of the numeric status/delivery index. Legacy/mixed identifier completion, retry, foreign-delivery and stale-mirror rollback are covered by isolated tests. See the PR validation for the measured local result; this is not a production latency guarantee.

## Invoice identity and fixed list status

Delivery rows display and search by `invoice.number` (the customer-facing invoice
number, preserving leading zeros). `invoice.id` is the MongoDB ObjectID used for
review/completion, document upload, signature selection and printing API calls.
Do not substitute the business number into those routes or expose the ObjectID
as a fallback display label. A missing business number remains blank.

The assigned barcode list is already scoped by the API to status ID 6 (CONDUCE),
so desktop/mobile rows and filter controls omit Status. The API status payload
and completion lifecycle checks remain available for compatibility. The receipt
footer's submitted `idNumber` identifies the signer; it is not an invoice ID.


## Zero-balance requirement (portal implementation; API enforcement required)

### Current portal audit — November 5, 2026

The earlier quoted TODO mixes current behavior with an older payment/override
workflow. Source review of the current checkout and the existing balance tests
establish the following; no portal runtime code was changed by this audit.

| Requirement | Current implementation / evidence |
| --- | --- |
| Authoritative zero balance | `fetchInvoiceById(..., true)` rejects null, blank, invalid or non-finite balances. An omitted balance is accepted only when cost is present and cost minus discount minus payment is zero. `verify()` requires exactly zero; negative balances stay blocked. |
| Refresh gates | `use-delivery-wizard.ts` calls `balance.verify()` before leaving the balance step and immediately before a new completion request. An uncertain completion retries the identical receipt payload instead of performing a new preflight. |
| USD / DOP display | The balance step uses the daily route rate for DOP; a missing rate is displayed as unavailable rather than fabricated. |
| Payment permissions | The hook currently requires delivery completion access (`canUpdateDelivery`, `canViewInvoice`, `canUpdateInvoice`), delivery list access (`canViewDelivery`), `canViewIncomeStatement` and `canCreateJournal`. It does **not** use `canCreateIncomeStatement` as the gate for paying into an already-open Cuadre. The creation dialog separately requires that grant. |
| Current Cuadre | Payment uses the collecting user's branch and current open Cuadre. A closed Cuadre is not reopened. When absent, the balance step offers `CloseoutRolloverDialog`; the dialog locks the branch, initializes USD and rate **1**, and uses the closeout calendar. It is not initialized from the delivery route rate, so the old route-rate setup requirement is not implemented as written. |
| Payment and cancellation | The PAYMENT mutation is separate from completion, with duplicate-payment confirmation and permission-gated auto-clear controls. It rereads the invoice after posting; there is no delivery-cancellation reversal of the payment. This is source evidence, not a fresh browser cancellation test. |
| Uncleared override | The current balance hook permits only zero. The completion schema has no override acknowledgment field, and the wizard does not query the pending-payment helper or submit such an acknowledgment. The older liability-checkbox flow is **not currently implemented**. |

Validation: `node --test tests/unit/delivery-balance.test.mjs` passed **17/17**
on November 5. Cases cover explicit/string zero, positive and negative balances,
missing/null/blank/invalid values, omitted-balance zero calculations and foreign
invoice responses. These tests validate portal balance reads, not backend atomic
completion or browser end-to-end behavior.

### Payment timing correction

The old statement that pending checks/Zelle/deposits/card receipts cannot reduce
invoice balance until cleared is stale. The verified journal contract applies
payments on create independently of reconciliation/clearance. November 5 ZELLE
and DEPOSIT control payments returned `clearanceStatus: OUTSTANDING` while
reducing the invoice balance on create; reversal restored it. See
[payment-accounts-api-contract.md](payment-accounts-api-contract.md#debit-card--wire-live-verification--november-5-2026)
and [pending-transactions-update.md](pending-transactions-update.md).
The delivery wizard trusts the freshly read API balance; it must not subtract
amounts locally or assume an outstanding directory record is an additional
unapplied payment.

### Uncleared-payment override — requested, not implemented

The older requested flow allowed a liability acknowledgment when outstanding
Check/Zelle/Deposit/card records covered the balance, with a fresh recheck before
completion. This needs a defined API contract and server audit evidence before
it can be marked implemented. The unused `delivery-pending-payments-api.ts`
helper alone does not establish that the wizard supports it. Because the current
API already applies those payments on creation, the outstanding-record coverage
rule also needs reconciliation with the authoritative balance semantics; do not
count already-applied payments twice.

Live check (November 3, 2026, [backend-api-gaps.md](backend-api-gaps.md)):
assigned barcode rows return `invoice.balance`, `sender { name, phones }` and
`route.rate`, and the completion route is deployed. The historical probe
completed delivery 10464 for invoice 488970 with a $70 balance (`200 Delivery
completed`, mock data). **Superseded by the approved November 5 recheck below,
which returned the balance-gate `409`.**

**Backend acceptance criteria still requiring broader verification:** the nonzero-balance guard is confirmed below, but verify that the invariant participates in the same transaction and invoice financial version/conflict check as completion. Verify unavailable/negative balances, zero-balance success, concurrent financial changes and absence of newly saved signatures on rejection. To support the override server-side, accept an explicit acknowledgment on completion (e.g. `unclearedPaymentOverride: true`) that is valid only when outstanding clearing records for the invoice cover the balance, and record the acknowledging user/time in the receipt and activity log. The portal does not send this field yet, so the acknowledgment is not persisted. Preserve idempotent replay of an already committed receipt. The frontend preflight alone cannot prevent a concurrent balance change or direct API calls. No server-side enforcement was changed here.

### Backend recheck limits and fixture cleanup — November 5, 2026

**Initial recheck limitation (subsequently resolved for the approved pair below):**
automatic approval review rejected a new mutation probe against existing
pending deliveries because their specific mock status was not established and
completion can irreversibly change operational status. No completion request
from that rejected probe was sent. The user subsequently confirmed the specific
previously tested delivery 10464 / invoice 488970 as disposable mock data and
authorized marking one remaining piece delivered if allowed.

A safer alternative created only new invoices and a new delivery. The API
assigned delivery **10469**, name `1-67-26` (it replaced the supplied probe name).
The first attempt stopped on this identity mismatch. After confirming its
creation response, a follow-up verified the newly created invoice identities
and attempted to read only their generated numeric barcode IDs **14** and **15**.
Both catalog GETs returned `404`, so the fixture could not be assigned/reviewed
for a valid completion probe. No barcode status or delivery completion was
mutated. Do not interpret this fixture failure as a balance-gate result.

The following new invoices were deleted, with subsequent GETs returning `404`:

| Probe invoice | Deleted invoice ID |
| --- | --- |
| `ZZ_ISOLATED_DELIVERY_PROBE_20261105_1793899954137_POSITIVE` | `6aecbdb587c1d88ee1a3d755` |
| `ZZ_ISOLATED_DELIVERY_PROBE_20261105_1793900023283_POSITIVE` | `6aecbdf887c1d88ee1a3d75c` |
| `ZZ_ISOLATED_DELIVERY_PROBE_20261105_1793900023283_ZERO` | `6aecbdf987c1d88ee1a3d763` |

Delivery 10469 was also deleted and GET-verified as `404`. Container **1400**
was used as a reference; its barcode/delivery sequences were consumed by fixture
creation and were not rolled back. Inline sender/receiver records and audit
history, if retained by the API, were not separately deleted; their names carry
the probe prefixes above. No payment journals were posted by this delivery audit.

### Approved completion probe — November 5, 2026

**Positive nonzero-balance enforcement now verified.** After the user's explicit
approval of delivery **10464** / invoice **488970**, exact-number search resolved
the correct invoice ObjectID as **`6a34c213a08ce327600be3ec`**. The previously
quoted ID `6a323358a08ce327600a5ef1` actually belongs to invoice **480406**;
that invoice was read for identity checking and was not mutated.

Invoice 488970's authoritative balance was **$70**. Review confirmed delivery
10464 and three remaining pending pieces. A valid completion request selected
one piece, **ET042260427**, using `legacyBarcodeIds: [765315]` (its canonical
barcode ID is all zero), the active policy IDs, an agreed acknowledgment and a
valid synthetic MOCK signature. No uncleared-payment override was sent.

The API returned **`409`**:

> delivery requires an exactly zero invoice balance and no uncleared payments;
> collect or clear payment, or resolve credit with accounting

The invoice balance stayed **$70**, version and `updatedAt` remained unchanged,
and review still returned all three pending pieces (ET042260427–ET042260429).
No completion succeeded, so no delivery change required reversal. The probe tag
is `ZZ_DELIVERY_BALANCE_PROBE_20261105_1793900716906`. An earlier attempt's
invalid tiny PNG returned validation `400`; that was a fixture error, not
balance-enforcement evidence, and was corrected before this result.

This supersedes the November 3 "not enforced" status for positive balances.
Keep **zero-balance success, zero with uncleared receipts, negative/unavailable
persisted balances, concurrency, failed-command receipt auditing and accepted
override semantics** open/unverified. The error message says uncleared payments
also block completion; it alone does not prove those paths were exercised.


## Delivery row exchange rate

Desktop and mobile deliveries show the linked daily route's `route.rate` as DOP
per USD. This is the same row rate used for DOP balance calculations. Missing or
invalid rates display a dash, never a fabricated zero. The API resolves the rate
from the assigned daily delivery route; no additional fetch is added for the
rate field. Deploy the API route-rate enrichment before expecting this field.
