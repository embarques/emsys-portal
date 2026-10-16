# Inventory Swagger verification

Source: [live Swagger JSON](https://api.embarqueros.com/swagger/doc.json), loaded
from the [Swagger UI initializer](https://api.embarqueros.com/swagger/swagger-initializer.js).
A trimmed snapshot, including its retrieval timestamp, is stored in
`tests/fixtures/inventory-swagger-contract.json`. Swagger version: 2.0; API version:
0.1.0; host: `api.embarqueros.com`; base path: `/v1`.

This is a documentation/contract comparison. No authenticated records were read,
created, posted, cancelled or modified. Absence from Swagger means **undocumented**;
it does not prove a route is absent from the running server.

## Result

The complete `inventory.md` workflow is **not verified as deployable**. Swagger
contains 22 inventory paths / 31 operations, covering catalog, suppliers, holders,
stock, receipts and dispatches. Keep the workflow deployment flag disabled until
the remaining contracts and authenticated acceptance tests are resolved.

| Area | Published Swagger | Workspace finding |
| --- | --- | --- |
| Base URL | `/v1` | Use configured API base URL; do not add `/api/v1` in feature paths. |
| Items/suppliers/holders | `/inventory/items`, `/inventory/suppliers`, `/inventory/holders` | Corrected the new workspace's root-level paths. |
| Receipts/dispatches | `/inventory/receipts`, `/inventory/dispatches`; POST create, GET detail, PATCH edit, POST post/cancel | Corrected paths. Multi-line documents, version and draft/posted/cancelled states match. |
| Default item price | Integer `defaultSellingPriceMinor` | Corrected form/payload field from `defaultSellingPrice`. |
| Holder kinds | WAREHOUSE, EMPLOYEE, VEHICLE, ROUTE_CREW | Matches; daily route remains a separate dispatch context field. |
| Draft concurrency | Required `If-Match` on PATCH, post and cancel | Added a local preflight guard for post/cancel without a valid version. |
| Posting retry | Required `Idempotency-Key` on receipt/dispatch post | Existing key support matches; post/cancel response is only a generic success envelope. |
| Stock | GET `/inventory/stock`, GET `/inventory/stock/{id}`, POST `/inventory/stock/search` | Workspace holder stock/movement subresources are not documented. Needs a stock adapter once filtering is confirmed. |
| Pagination | `responses.Success`: `page`, `resultsPerPage`, `subtotal`, `total` | Workspace expects `nextCursor`; no cursor field is documented. Inventory list/search request parameters are omitted from Swagger. |
| Errors | `responses.Error`: string `error`, `message`, `success` | Added support for string errors; structured proposal error codes/details remain unverified. |
| Permissions | `/users/permissions` returns `{role, permissions:[{name, resourceType}]}` | Shape matches. Specific `inventory.read`, `inventory.post`, `closeout.*` grants are not documented. |
| Authentication | Authorization / X-Company-ID security definitions | Central Axios attaches both. Swagger expresses them as separate alternatives, although its description says tenant company is required; clarify the Swagger security declaration. |

## Not documented in the published schema

- Returns, dispositions, physical counts and adjustments.
- Supply sales reports, payments, allocations, cash handovers, collection obligations
  and settlements.
- Closeout creation, preview, close, reopen and revisions.
- Holder stock/movement subresources, custody assignments and administrative stock
  reassignment.
- Item price-history endpoints.
- `/route-crews` and `/daily-routes`. Existing `/routes` and `/vehicle-routes` use
  different payloads, so changing names alone would not integrate them.
- Inventory stock valuation, sales, discrepancy and obligation report endpoints;
  `/audit-events` and `/journal-entries`. Existing report-generation, user-activity
  and journal routes are not assumed to be interchangeable.

The proposal's allocation target type and handover statuses cannot be confirmed
because those operations/models are not present in this Swagger document.

## Existing portal compatibility

The original inventory adapter also needs migration. It still parses single-item
receipt/dispatch records and writes fields such as `incomeGained` / `dispatchedTo`,
while Swagger now describes `lines[]`, `fromHolderId`, `toHolderId`, `status` and
`version`. Its PUT and DELETE operations are not documented for these inventory
resources; Swagger exposes PATCH and draft cancellation instead. The new feature
flag does not make those existing screens compatible with the changed contract.

## Checks added

`tests/unit/inventory-swagger-contract.test.mjs` compares the supported workspace
paths and item payload against the captured Swagger subset and verifies that
posting/cancellation include its required headers. Run together with the workflow
unit tests. These are local contract checks, not production transaction tests.
