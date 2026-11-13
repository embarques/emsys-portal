# Portal suggestions versus existing backend contracts

Reviewed November 13, 2026 against the current portal source, checked-in
[OpenAPI schema](../api-docs.json), and recorded
[November 13 API verification](backend-gap-follow-up-2026-11-13.md).

This document isolates disagreements between portal expectations/proposals,
published contracts and observed API behavior. The broader
[backend gap index](backend-api-gaps.md) remains the execution backlog; its B/F/V
identifiers are retained below. Suggested resolutions here are recommendations,
not newly agreed API contracts.

No backend source checkout was inspected and no live requests were made for this
document. Runtime findings refer to the saved mock-company evidence, not a new
production audit. A missing OpenAPI operation does not establish a missing API
route, and an untested scenario does not establish a backend defect.

## Confirmed mismatches

| ID / area | Portal expectation or suggestion | Existing contract / observed behavior | Recommended alignment and owner |
| --- | --- | --- | --- |
| M01 — Loan increase (B12/F04) | The gated adapter posts employee/source account, amount, date and description to `POST /loans/{id}/increases`, without `requestId`. Source comments still call the command unavailable/proposed. | The route is deployed and rejects the real adapter for missing `requestId`. The operation and command schema are absent from the checked-in specification. A valid issue/increase/payment lifecycle is not yet established. | **Shared:** backend publishes command identity, replay, permission and atomicity semantics; portal sends a stable identity for each logical operation and updates stale comments. Keep the existing feature gate until a valid lifecycle passes. |
| M02 — Directory fields (B09) | Portal-aligned search candidates include the fields in the table below. | 53 directory filter/sort candidates return unsupported-field HTTP 400 in the recorded matrix. Generic `query.Request` does not imply every visible column is queryable. | **Shared product/API decision:** support an indexed field, agree an equivalent wire field, or omit that capability in the portal. Publish per-operation allow-lists and map any aliases in the feature adapter. |
| M03 — Loan amount search (former B06; B05) | Proposed filters/sorts include `paidAmount` and `balance`. | All four filter/sort probes now explicitly return HTTP 400. The earlier HTTP 500 is fixed; these fields were not thereby implemented. Current portal loan filter metadata omits them. | **Backend documentation / optional enhancement:** publish exclusions and sort allow-lists. Add these capabilities only through an agreed contract; do not label their rejection a current runtime regression. |
| M04 — Bank clearance (B05) | The portal treats successful clearance as atomic settlement and reconciliation, using create → clear for explicit clear-on-save. | Recorded runtime does reconcile on clearance. Published `POST /journals/clear` still says it never changes reconciliation status and may run before or after reconciliation. | **Backend publication:** correct the description and lifecycle/grant rules to match verified runtime. Portal orchestration already follows that behavior; do not add another reconciliation call based on the stale description. |
| M05 — Reconciliation enum (B05) | Portal lifecycle handling recognizes `NOT_REQUIRED` as well as `OUTSTANDING` and `RECONCILED`. | API responses include `NOT_REQUIRED`; published `journal.Journal.reconciliationStatus` only lists the other two values. | **Backend publication:** add the value and document applicable transaction/lifecycle states. |
| M06 — Route business date (B05) | Portal uses `GET /vehicle-routes/business-date`, optionally scoped by `branchId`, and validates `businessDate`, `timezone`, `serverTime`, `nextMidnight`. | The endpoint works for assigned-only crews in recorded tests but is missing from published/checked-in OpenAPI. | **Backend publication:** add request/response, scope, permission and error contracts. This is a documentation gap, not an absent endpoint. |
| M07 — Unassigning pieces (B05/V07) | Explicit `route: null` removes an unfinished assignment; omission preserves it, including invoice-embedded patches. | Recorded catalog and embedded removal/synchronization pass. Published barcode route references do not express nullability or the full removal/date/delivered rules. | **Backend publication:** document null versus omission on catalog and embedded shapes, synchronization and lifecycle errors. Actual CONDUCE/delivered coverage remains blocked by M10. |
| M08 — Bulk piece identity (V06/B05) | Assignment expects 1–200 distinct positive uint32 piece IDs, atomic rejection, duplicate 400, missing 404, delivered/conflict 409. | Schema only says integer array. Embedded numeric IDs differ from catalog IDs; matched branch/container and RD controls still return eligibility 400. Missing-ID mixes return 400 rather than the stated 404. No successful positive bulk control establishes which identity is accepted. | **Backend contract clarification, then portal mapping:** define the numeric identity and eligibility precisely, publish constraints/errors, and demonstrate a valid request before certifying atomicity. Successful replay may allocate another trip; do not promise idempotent trip allocation. |
| M09 — Expense classification (B15) | An EXPENSE category should resolve to a persisted, eligible expense account. | `POST /journals` accepts persisted ASSET account 5 when supplied as `{id: 5, name: "Gasolina", type: "EXPENSE"}`; saved ledger uses the forged classification. A genuine EXPENSE positive control passes. | **Backend defect:** resolve classification from persisted tenant data, validate eligibility and use canonical metadata. Test create/sync/update and unchanged state on rejection. This is separate from the funding-reference paths already fixed under B10. |
| M10 — Invoice-piece status (B16) | New pieces should expose the documented ALM-NY default, and successful embedded updates should expose selected CONDUCE status. | New-piece readbacks omit status. A versioned PUT sending `{status: {id: 6, name: "CONDUCE"}}` succeeds and persists the route, but invoice/catalog readbacks still omit status. | **Backend defect investigation:** distinguish persistence from response projection; persist/expose supported states or explicitly reject unsupported writes. Then verify status-dependent locks and trip behavior. |
| M11 — Search operation publication (B05) | Portal consumes reserved-invoice search and approval/change-request search. | Both deployed routes are absent from the checked-in/published specification in the saved publication check. Reserved POST returns a flat `data` array plus page metadata; GET uses `data.items` and cursor metadata. Portal reserved adapters already handle the difference. | **Backend publication:** describe both operations and their actual envelopes, grants, filters, sorts and pagination. There is no current reserved-response adapter defect established by this evidence. |

Evidence and implementation references:

- M01: [adapter](../src/lib/accounting/loans/api.ts),
  [gate](../src/lib/accounting/loans/loan-increase.ts),
  [required-requestId control](backend-gap-controls-2026-11-13.json), and
  [loan fixture prerequisite](section3-loan-scoped-evidence-2026-11-13.json).
- M02–M03: [242-probe matrix](backend-gap-readiness-recheck-2026-11-13.json),
  [explicit loan rejection controls](backend-gap-contract-controls-2026-11-13.json),
  and [current loan filter definitions](../src/lib/accounting/loans/filter-fields.ts).
- M04–M07/M11: [Scalar/Swagger publication comparison](scalar-publication-recheck-2026-11-13.json),
  [runtime/schema readback](backend-gap-readback-recheck-2026-11-13.json),
  [clearance orchestration](../src/lib/accounting/daily-income/create-journal-with-clearance.ts),
  and [business-date adapter](../src/lib/pickup-delivery-routes/api/route-business-date-api.ts).
- M08: [saved prerequisites](section3-invoice-readback-evidence-2026-11-13.json),
  [RD control](section3-invoice-rd-evidence-2026-11-13.json), and
  [identity/lookup attempt](section3-invoice-identity-lifecycle-evidence-2026-11-13.json).
- M09: [final financial matrix](section3-matrix-final-evidence-2026-11-13.json).
- M10: [final invoice lifecycle requests/readbacks](section3-invoice-final-lifecycle-evidence-2026-11-13.json).

## Exact directory capability differences (M02)

These are rejected candidates from the saved audit, not proof that every field
is currently offered as an enabled portal control. Each filter/sort cell lists
the wire fields needing a support decision. Paths are relative to `/v1`.

| Search endpoint | Unsupported filter candidates | Unsupported sort candidates |
| --- | --- | --- |
| `/branches/search` | `address.address1`, `address.country`, `settings.labelPrefix`, `disclaimer` | `address.address1`, `address.country`, `settings.labelPrefix` |
| `/containers/search` | `barcodeSequence`, `deliverySequence` | `number` |
| `/customers/search` | `notes`, `receivers` | — |
| `/employees/search` | `loanBalanceUpdated` | — |
| `/inventory/dispatches/search` | `supplierName`, `postedAt`, `postedBy.name` | `supplierName`, `fromHolderName`, `postedAt`, `postedBy.name` |
| `/inventory/receipts/search` | `supplierName`, `postedAt`, `postedBy.name` | `supplierName`, `toHolderName`, `postedAt`, `postedBy.name` |
| `/inventory/suppliers/search` | — | `name` |
| `/invoice-descriptions/search` | `createdBy.name`, `updatedBy.name` | — |
| `/invoices/search` | `invoiceDetails`, `itemCount`, `legacySyncedAt`, `branch.name`, `branch.code` | — |
| `/journals/search` | `invoice.discount`, `accounts.type`, `transactionBalance`, `currency`, `customer`, `loan` | — |
| `/pickups/search` | `routeNumber` | `routeNumber` |
| `/roles/search` | `permissions` | — |
| `/vehicle-routes/search` | `createdAt`, `driver.name`, `supervisor.name`, `helpers.name` | `driver.name`, `supervisor.name`, `helpers.name` |
| `/vehicles/search` | `inspectionDate`, `registrationDate` | — |

The matrix has 57 unsupported probes total: these 53 plus M03's four loan probes.
Twelve previously rejected candidates now pass: pickup legacy-sync/completed-by
filter/sorts and all six assigned-delivery candidates. Keep those out of the
current mismatch count. Avoid client-side whole-directory filtering or N+1
lookups as substitutes for missing server capabilities.

## Contract decisions still open

These boundaries lack sufficient agreement or evidence to call them confirmed
implementation defects.

| Area | Portal intent / unresolved contract | Decision or evidence needed |
| --- | --- | --- |
| Received-at dates (B05/V14) | Date-only filters should use the business calendar day; timestamps should compare instants. `receivedAt` must remain distinct from generation, reservation and assignment time. | Nullable field/filter support and invalid-date rejection pass. Establish the authoritative timezone and non-null midnight/DST boundaries; publish semantics. See [reserved search contract](reserved-invoice-search-api-contract.md). |
| Delivery identity (V11) | Portal works with DR daily routes and embedded/catalog pieces; legacy delivery identity can be a different numeric reference. | Agree identity mapping/migration before substituting IDs in review, completion or signature payloads. See [delivery contract decisions](delivery-completion-api-contract.md). |
| Cash/loan account setup (B12/V05) | UI proposals assume eligible branch-local accounts can be selected/created. | Fixture-branch LOAN account creation returned 400; cash child creation without an accepted code also rejected. Publish allowed parents, types, allocation ranges and defaults; establish valid controls. Rejection alone does not prove broken account creation. See [payment-account acceptance](payment-accounts-api-contract.md). |
| Directory metadata (F02) | Portal tables/schema coverage should describe lifecycle/version, account/route/inventory and report fields, including intentional omissions. | Produce a field-level mapping before treating this broad audit task as a specific backend defect. |
| Complete alerts (I08) | Low-pool and vehicle due/overdue suggestions require full company/branch coverage and a business calendar. | Agree backend notification coverage and calendar rules. Rejected vehicle date filters in M02 prevent assuming the suggested queries work; first-page scans cannot establish complete alerts. |

## Stale portal statements and resolved differences

Some disagreement is now in portal documentation rather than runtime code:

- [APP_CONTEXT.md](../APP_CONTEXT.md) still says reserved advanced search awaits
  an endpoint and loan increase awaits deployment. Recorded tests establish both
  routes exist; loan increase still needs M01 alignment and lifecycle verification.
- APP_CONTEXT's `receivedBy` replacement/backfill TODO should distinguish migration
  from schema support: the checked-in invoice create/update/read schemas already
  expose `receivedBy`, while the portal retains legacy fallbacks. Legacy-data
  backfill and all assigned-invoice variants are not certified by that fact.
- Reserved GET sort direction and POST parsing now pass. Bounded journal sorting,
  tested funding-reference validation and ordinary branch-DTO invoice creation
  also pass. Preserve remaining scope/load/lifecycle limits instead of carrying
  forward older failure claims. See the [latest outcomes](backend-gap-follow-up-2026-11-13.md).

Failure injection, commit-window authorization races, full tenant isolation,
historical migrations and clock-controlled lifecycle checks remain in the
[verification backlog](backend-api-gaps.md). Their unverified status alone is
not a portal/backend contract mismatch.

## Suggested order of resolution

1. Fix financial classification trust (M09); resolve status readbacks (M10) and
   bulk identity/eligibility (M08), which block meaningful downstream acceptance.
2. Agree and publish loan increase identity/replay rules, align the gated adapter
   and establish a valid lifecycle (M01).
3. Decide each rejected search capability (M02–M03), then align portal controls
   with the actual per-operation allow-lists.
4. Publish the runtime contracts (M04–M07/M11), resolve the open semantic
   decisions, and update stale portal statements against that evidence.

Close an item with the agreed schema, corresponding portal mapping and focused
behavioral evidence. Publication alone does not prove runtime support; a passing
sample does not establish every permission, tenant, lifecycle or concurrency case.
