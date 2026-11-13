# Backend/API gaps — remaining work

Updated November 13, 2026. Remaining fixes and checks, grouped by ownership.

## 1. Backend/API fixes

All endpoint paths below are relative to `/v1`. Schema names refer to
`components.schemas` in [API-Docs.json](../API-Docs.json); the published Scalar specification is
[`GET /scalar/openapi.json`](https://api.embarqueros.com/scalar/openapi.json),
with Swagger separately available at `GET /swagger/doc.json`. Each item identifies the
contract surface that still needs implementation or publication.

### B05 — Publish the affected OpenAPI contracts

Update the specific operations and schemas below in the published specifications
and the checked-in schema. Supporting requirements are in
[daily-route assignment](daily-route-assignment-api-contract.md),
[payment accounts](payment-accounts-api-contract.md),
[financial controls](financial-controls.md) and
[reserved invoice search](reserved-invoice-search-api-contract.md).

| Operation / schema | Contract detail to publish or correct |
| --- | --- |
| `GET /vehicle-routes/business-date` | Optional `branchId`; response `data.businessDate`, `timezone`, `serverTime`, `nextMidnight`; assigned-only access and branch scope. Add the missing operation. |
| `PUT /barcodes/{id}` → `barcode.Barcode.route` | `route: null` removes an unfinished assignment; an omitted `route` preserves it. Document delivered-state rejection and source/destination date constraints. |
| `PUT /invoices/{id}` → `invoice.UpdateInvoiceRequest.invoiceDetails` → `invoice.InvoiceDetail.barcode` / `barcodes[]` | Document the same nullable route semantics for embedded pieces, catalog/embed synchronization and delivered/date constraints. |
| `PUT /invoices/item/barcode/route/{routeId}` → `invoice.AssignBarcodesRouteRequest.barcodeIds` | Array of 1–200 distinct positive uint32 piece IDs; atomic rejection; duplicate 400, missing 404, delivered/conflict 409. State that successful replay may allocate another trip rather than promise idempotent trip allocation. |
| `POST /journals/clear` → `journal.ReconcileRequest` | `{requestId, ids}` command, clearance grant, atomic settlement/reconciliation, deferred invoice application, actor/payload-bound replay and all-or-nothing failures. Remove the description claiming clearance never changes reconciliation. |
| `journal.Journal.reconciliationStatus` and `POST /journals/reconcile` | Include `NOT_REQUIRED` in the enum; document lifecycle exclusions and rejection of standalone reconciliation for unsettled bank journals. |
| Directory search operations listed under B09, plus `POST /invoices/reserved/search` | Publish each operation's actual filter fields/operators, sort fields/directions, pagination and validation errors. Explicitly document the flat reserved-search `data` array and page metadata separately from GET's cursor-page envelope. |

Additional contracts to publish:

- `/loans/search`: supported sort fields/directions, unsupported sort exclusions
  and specific filter/sort validation errors.
- `GET /invoices/reserved`: supported sort fields/directions, deterministic ties
  and cursor binding to sort/filter/company context.
- `POST /change-requests/search`: filter/operator/sort allow-lists, pagination,
  permissions, assignment scope and null-review semantics for status,
  resourceType, action, requestedBy/reviewedBy IDs/names and createdAt/reviewedAt.
- Reserved-invoice `receivedAt`: nullable RFC 3339 field, authoritative business
  timezone, date-only versus timestamp semantics, operators and validation.

### B09 — Directory search field contracts

Each row in the table below identifies a `POST /…/search` operation whose
filter/sort allow-list needs support or a documented equivalent. Requests use
`query.Request`: filter leaves `{field, operator, value}`, sort entries
`{field, direction}`, and `pagination: {page, limit}`. Unsupported candidates
currently return HTTP 400; publishing a field without implementing it is not
sufficient. Any alternative wire name must also be mapped in the corresponding
portal feature adapter.

The 53 remaining directory field/sort candidates are listed below. Loan search
exclusions require publication under B05.

#### B09: fields needing support

Provide indexed filter/sort support or document equivalent supported fields.
Agree on wire names for denormalized supplier, holder and crew names.

| Search endpoint | Filters to support | Sorts to support |
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

### B12 — Loan increase contract and valid lifecycle

- Publish the required requestId schema, capability, payload/actor binding,
  replay/errors and atomic principal/balance/journal contract for
  `POST /loans/{id}/increases`.
- Establish an eligible LOAN account and current period in an isolated fixture
  branch, then verify issue/increase/payment, replay, concurrency and linked
  journal invariants. Resolve the account-setup contract: creating a LOAN account
  in a fixture branch returns 400.
- Align the gated portal adapter with the agreed requestId contract (F04), and
  verify the valid lifecycle before enabling the action.
- References: [requestId validation](backend-gap-controls-2026-11-13.json),
  [account-creation prerequisite](section3-loan-scoped-evidence-2026-11-13.json).

### B15 — Resolve the EXPENSE classification account from persisted data

- `POST /journals` accepts `account: {id: 5, name: "Gasolina", type: "EXPENSE"}`
  although persisted account 5 is LOAN RECEIVABLE / ASSET. The saved ledger debits
  ID 5 under the supplied forged name/type.
- Resolve `PostEntryRequest.account` within the tenant, enforce transaction-type
  compatibility/posting eligibility and canonical metadata before any write.
  Extend the check to create/sync/update and verify rejection preserves financial
  state and retry identity.
- Evidence: [final financial matrix](section3-matrix-final-evidence-2026-11-13.json),
  labels `Persisted ASSET spoofed as EXPENSE category` and its saved readback.

### B16 — New/embedded invoice-piece status persistence

- Newly created pieces omit the documented ALM-NY status. The real embedded
  update adapter sends `{status: {id: 6, name: "CONDUCE"}}` with the captured
  If-Match; PUT succeeds, the route persists, but invoice/catalog readbacks omit
  status.
- Persist the documented default and supported status changes, or explicitly
  document/reject unsupported writes. Successful requests must not silently lose
  the selected status. Then verify real CONDUCE/delivered locks and trip effects.
- Evidence: [exact requests and readbacks](section3-invoice-final-lifecycle-evidence-2026-11-13.json).
  This proves missing status in API readbacks; database internals need backend
  inspection before distinguishing lost persistence from projection defects.

### Invoice bulk identity/eligibility contract — V06 prerequisite

Define which numeric identity `PUT /invoices/item/barcode/route/{routeId}`
resolves and its exact branch/container eligibility. Embedded IDs are local
sequences and differ from catalog IDs. Matching branch/container fixtures still
receive eligibility 400; missing-ID mixes return 400 instead of the specified
404. Establish a valid positive control before certifying bulk atomicity/replay.

Resolve the bounded 200-row catalog prefix lookup timeout without introducing
N+1 lookup workarounds. References: [persisted prerequisites](section3-invoice-readback-evidence-2026-11-13.json),
[RD control](section3-invoice-rd-evidence-2026-11-13.json) and
[identity lookup attempt](section3-invoice-identity-lifecycle-evidence-2026-11-13.json).

## 2. Portal/API alignment

- **F02 — Table/schema metadata.** Align table fields and schema references,
  including lifecycle/version fields, journal account/route/inventory metadata
  and report fields. Mark intentionally hidden fields explicitly.
- **F04 — Loan increase adapter.** Once the requestId/replay contract is agreed,
  send a stable operation identity from the currently gated loan-increase flow;
  verify a valid loan lifecycle before enabling it.
- **F03 — Authentication and company context.** Verify Firebase login,
  refresh/logout and company switching. Resolve the origin configuration for
  local integration at `127.0.0.1:3100` and `localhost:3100`.

## 3. Remaining live API verification

These rows describe remaining live server behavior. Local portal checks do not
establish those persisted outcomes.
Many can be invoked through the portal or a programmatic API client once their
API prerequisites and fixtures are available; they do not all require a backend
developer to execute them. Database failure injection and commit-time races
require the backend controls in Section 4.

| ID | Remaining verification |
| --- | --- |
| V02 | Injected settlement failure and closed-period/lifecycle transitions |
| V05 | Fix B15 classification trust; cover inactive/non-posting/cross-company accounts, protected BANK changes, child-account allocation and remaining cash/expense correction paths |
| V06 | Resolve numeric identity/eligibility prerequisite; verify valid bulk assignment, missing/foreign/delivered atomicity and replay trip allocation |
| V07 | Fix B16 to establish actual CONDUCE/delivered states; verify nonempty delivery-ID/trip preservation/reset, legacy pieces and completion races |
| V08 | Full linked financial/history evidence across invoice deletion; preserve financial/audit records |
| V09 | Address-only changes on seeded legacy duplicate identities with linked history; preserve protected identities and history |
| V10 | Unpaid-registration completion and assigned invoice ownership/customer negatives, revocation/replay, initial-payment effects, branch 11 and explicit receivedBy variants |
| V11 | Server enforcement of delivery balance/policy/photo ownership and assigned-only scope under tampered requests, concurrent changes and multiple actors |
| V12 | Injected inventory failure atomicity, remaining valuation/disposition paths and broader permission/autoReconcile combinations |
| V13 | Real clock-controlled STALE_OPEN_CLOSEOUT/LATEST_CLOSED transitions and cross-period mutation rejection |
| V14 | Tenant/branch/filter-bound cursors, mutation/concurrency sort ties and non-null receivedAt business-day boundaries |
| V15 | Remaining approval actor/reviewer permission combinations, invoice/journal/label/inventory actions, pickup VOID and live cross-company/branch isolation |

## 4. Backend integration and production checks

- **I01 — Transaction boundaries.** Prove complete rollback for invoice/pickup
  bulk assignment, invoice patches, delivery-versus-movement/removal and midnight
  crossings, including failures between dependent writes.
- **I02 — Authorization commit windows.** Verify in-flight grant revocation and
  the separate crew-membership window. Measure throughput/latency of guarded
  mutations holding user/role/grants through commit.
- **I03 — History and lifecycle migration.** Verify commit-before-history
  ordering, seeded tenant history indexes, deletion history, void/correct paths,
  reversal entries, critical activity and legacy pending-queue/badge exclusion.
  Confirm persisted history directly and align it with activity responses.
- **I04 — Account allocation/migration.** Verify deep ancestry, parent/cycle
  rules, occupied/exhausted codes, concurrent allocation, protected types and
  preservation of legacy mappings/historical postings.
- **I05 — Historical attribution and analytics.** Reconcile production
  manifests and analytics across legacy invoice/journal snapshots, movement,
  membership/responsibility changes, joint custody and timezone histograms.
- **I06 — Deployed legacy service.** Verify real confirmation failure/success,
  replay and no repeated remote call after confirmation.
- **I07 — Query capacity.** Verify database indexes/query plans, representative
  load and performance budgets.
- **I08 — Complete alerts.** Implement/verify backend low-pool and vehicle
  inspection/registration due/overdue notifications,
  business-calendar evaluation, company/branch scope and full directory coverage.
  Resolve the rejected vehicle date queries; avoid first-200/N+1 coverage limits.
