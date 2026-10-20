# Inventory Swagger verification

Source: [live Swagger JSON](https://api.embarqueros.com/swagger/doc.json), loaded
from the [Swagger UI](https://api.embarqueros.com/swagger/index.html). A trimmed
snapshot with its retrieval timestamp is stored in
`tests/fixtures/inventory-swagger-contract.json`. Swagger 2.0; API version 0.1.0;
host `api.embarqueros.com`; base path `/v1`.

This is a documentation/contract comparison. Unauthenticated `GET` requests
confirmed that every documented route exists on the running server (HTTP 401
rather than 404). No authenticated records were read, created, posted, cancelled
or modified.

## Result

Swagger now documents the full `inventory.md` model: 96 inventory-related paths /
123 operations, covering catalog, prices, suppliers, holders (stock, movements,
custody, reassignment), stock, receipts, dispatches, returns, dispositions, counts,
adjustments, sales reports, payments and allocations, cash handovers, collection
obligations and settlements, closeouts (preview, close, reopen, revisions), the four
inventory reports, `/route-crews`, `/daily-routes`, `/audit-events` and
`/journal-entries`. The portal now targets those paths.

| Area | Published Swagger | Portal |
| --- | --- | --- |
| Base URL | `/v1` | Configured API base URL; feature paths never repeat the version. |
| Lists | `GET` with `responses.Success` (`page`, `resultsPerPage`, `total`); filters via `POST …/search` (`query.Request`) | Page-based loading. Supply operations filters use the search DSL (`eq` filters). Null `data` is an empty page. |
| Catalog / suppliers | `PATCH` + `If-Match`; no DELETE | Stock and Suppliers edit with PATCH and **deactivate** (`isActive: false`) instead of deleting. |
| Receipts / dispatches | `lines[]`, `toHolderId` / `fromHolderId`, `status`, `version`; PATCH, post, cancel | Stock, Receipts and Dispatches screens create drafts and post/cancel them. Dispatches send no revenue. |
| Adjustments | Draft + post with `If-Match` + `Idempotency-Key` | "Adjust stock" creates and posts an adjustment. |
| Commands | `If-Match` on post/cancel/submit/receive/close/reopen/status/allocations/settlements; `Idempotency-Key` on post-type commands | Headers are derived per command; the contract test compares them with Swagger's required headers. |
| Updates | PATCH for items, suppliers, receipts, dispatches; PUT for route crews, daily routes | Matches. Returns, dispositions, counts, adjustments and sales reports have no update route, so drafts are cancelled and recreated. |
| Enums | HolderType, StockCondition, PaymentMethod/Status, HandoverStatus (`PENDING`/`RECEIVED`), AllocationTarget (`SALES_REPORT`/`COLLECTION_OBLIGATION`), DispositionType, PricingMode | Matches; `SOLD` dispositions are never entered manually. |
| Errors | `responses.APIResponse`: string `error`, `message`, `success` | Shown as returned. |
| Permissions | `inventory.read`, `sales.read`, `payments.read`, `payments.allocate`, `payments.handover`, `payments.handover.receive`, `collections.read`, `closeout.read`, `closeout.reopen`, `reports.read`, `audit.read`, `routes.read` | Supply operations gates on these; other write capabilities follow `inventory.md`. The Stock/Receipts/Dispatches/Suppliers screens keep their existing `canList…`/`canUpdate…` grants (post/cancel use the update grant). |

## Still unconfirmed

- Swagger leaves most write capabilities as "the documented named capability".
  `inventory.create`, `inventory.post`, `inventory.adjust`, `inventory.count`,
  `catalog.manage`, `sales.record`, `sales.post`, `payments.record`,
  `payments.verify`, `payments.manage`, `collections.manage`, `collections.settle`,
  `closeout.record`, `closeout.finalize`, `inventory.holder.manage`,
  `inventory.reassign` and `routes.manage` come from `inventory.md`.
- Crew `role` is a free string; the portal offers `driver`, `appraiser`, `helper`.
- Holder `entityId` for vehicles uses the vehicle record `id`.

Decided in `docs/INVENTORY_FEATURE_BACKEND.md` (target contract): versions start
at 1 (the portal still accepts any non-negative integer), PATCH is a JSON merge
patch, ids are UUIDs, and each `/search` endpoint’s allowed fields are listed
there until Swagger publishes them.

## Checks

- `tests/unit/inventory-swagger-contract.test.mjs`: every workflow resource, create,
  edit method, child list and command route exists with Swagger's method and
  required headers; create bodies only use documented properties; select options
  match Swagger enums; legacy screens use no undocumented DELETE/PUT.
- `tests/unit/inventory-api.test.mjs`: the Stock/Receipts/Dispatches/Suppliers API
  module sends documented multi-line payloads, `If-Match` / `Idempotency-Key`
  headers, deactivation instead of delete, and reads the nested `audit` block.
- `tests/unit/inventory-workflow.test.mjs`: business rules (multi-line dispatch,
  exact cents, damage resolution, price groups, closeout reconciliation, PUT
  preservation).

These are local contract checks, not production transaction tests.
