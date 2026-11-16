# Swagger/Scalar publication and schema parity

Standalone handoff. Restructured November 15, 2026. The November 16 follow-up
records backend source changes and local validation; historical observations
retain their November 13–14 dates. Deployed acceptance remains open.

Each ID uses **Issue → Expected result → Suggested action**, with actions split
into **API work**, **Database work**, and **Both — API and database together**.
API work covers commands, permissions, business rules and published contracts.
Database work covers persisted-state verification, indexes, seeds and migrations
where justified; verification does not automatically require a schema change.
Both covers atomicity, concurrency and acceptance across API and persisted state.
Portal work is explicitly assigned to portal owners rather than backend teams.

Scope: **B05**. All requirements and acceptance steps needed for this packet
are included here; recipients do not need other portal files. Source observations
refer to API revision `4fdef23abcbaa89778d9ea6ca2d8f28b633cd270`.
Backend source paths are optional pointers in the recipient's own repository.
Endpoint paths are relative to `/v1`. Confirmed defects, unverified scenarios and
proposed designs are different states. Previously passing cases are regression
controls, not newly open defects. Use actual backend DTOs; proposed shapes below
are explicitly labeled and must be published before integration.

## B05 — Publish accurate Swagger and Scalar contracts

### November 16 implementation follow-up

The backend checkout is now at `8d12b5d`, matching freshly fetched `dev`; the
source observations below used the older `4fdef23` revision. Fresh public Swagger
and Scalar GETs on November 16 still returned 297 paths / 350 schemas / 432
operations, versus current source 311 / 371 / 448. All four listed operations
already exist in current source and remain absent publicly. Publication rollout
is still required.

Backend fixes are submitted in [API PR #374](https://github.com/embarques/emsys-api/pull/374)
on `fix/b05-swagger-scalar-publication`: nullable
`core.Barcode.route`, positive uint32 bulk item bounds, current route-removal
descriptions and date/sort validation details, with generated/served contract
regressions and a backend-owned public snapshot comparison. Completion and check
results are recorded in the backend's `docs/contracts/b05-publication-verification.md`.
Source fixes do not close deployed parity or authenticated HTTP acceptance.

The new contract tests also established that this dev baseline lacks the selected
B09 allow-list additions, despite the earlier publication-focused handoff. PR
#374 therefore adds actual branch prefix, container sequence, vehicle calendar
date and inventory posting-time searches, with numeric/date validation, scoped
server pagination and stable sort ties. It also corrects the missing date-time
format declaration for reserved `receivedAt`.

Local `go fmt ./...`, `go vet ./...`, the full Go suite (database integration
disabled), and exact `make swagger` passed. The backend-owned comparison against
saved public specifications detected the expected deployment drift. The backend
verification report contains the commands, scope/query-count controls and skipped
acceptance checks; PR #374 carries the final CI result. These source changes await
review and rollout; they do not establish deployed HTTP/database acceptance.

Current source implements shared-trip assignment and reuses the trip for an
unchanged assignment. The older replay warning below is historical compatibility
evidence, not the current source guarantee or proof of deployment. The single
embedded `barcode` remains a nullable legacy summary; route updates use plural
`barcodes[]`. Backend clarification also retains the existing increasing barcode
sequence: deletion leaves its counter unchanged and numbers retired. The
reservation-table proposal is withdrawn; import/reseed counter preservation and
atomic concurrent allocation remain separate verification work.

### Issue

**Confirmed publication drift and two source-schema omissions.** November 14
revalidation found public Swagger/Scalar at 297 paths / 350 schemas / 432 operations,
versus reference 311 / 371 / 448. Eleven selected public declarations remain
missing or incomplete; two also need source correction: nullable single embedded
`core.Barcode.route` and positive uint32 bulk-item bounds.

The four absent public operations are GET `/vehicle-routes/business-date`, POST
`/loans/{id}/increases`, POST `/invoices/reserved/search` and POST
`/change-requests/search`. This does not prove runtime routes are absent.
Source-declared requestId and other existing declarations are publication tasks,
not newly missing runtime implementations. Portal metadata audit passes 26
surfaces / 450 fields against the API reference; `api-docs.json` was removed.

### Expected result

| Operation / schema | Contract detail to publish or correct |
| --- | --- |
| `GET /vehicle-routes/business-date` | Optional `branchId`; response `data.businessDate`, `timezone`, `serverTime`, `nextMidnight`; assigned-only access and branch scope. Add the missing operation. |
| `PUT /barcodes/{id}` → `barcode.Barcode.route` | `route: null` removes an unfinished assignment; an omitted `route` preserves it. Document delivered-state rejection and source/destination date constraints. |
| `PUT /invoices/{id}` → `invoice.UpdateInvoiceRequest.invoiceDetails` → `invoice.InvoiceDetail.barcode` / `barcodes[]` | Document the same nullable route semantics for embedded pieces, catalog/embed synchronization and delivered/date constraints. |
| `PUT /invoices/item/barcode/route/{routeId}` → `invoice.AssignBarcodesRouteRequest.barcodeIds` | Array of 1–200 distinct positive uint32 piece IDs; atomic rejection; duplicate 400, missing 404, delivered/conflict 409. State that successful replay may allocate another trip rather than promise idempotent trip allocation. |
| `POST /journals/clear` → `journal.ReconcileRequest` | `{requestId, ids}` command, clearance grant, atomic settlement/reconciliation, deferred invoice application, actor/payload-bound replay and all-or-nothing failures. Remove the description claiming clearance never changes reconciliation. |
| `journal.Journal.reconciliationStatus` and `POST /journals/reconcile` | Include `NOT_REQUIRED` in the enum; document lifecycle exclusions and the confirmed policy allowing internal reconciliation of uncleared bank receipts without clearing/applying them; clearance atomically reconciles and applies eligible deferred receipts once. |
| Directory search operations listed under B09, plus `POST /invoices/reserved/search` | Publish each operation's actual filter fields/operators, sort fields/directions, pagination and validation errors. Explicitly document the flat reserved-search `data` array and page metadata separately from GET's cursor-page envelope. |

Additional contracts to publish:

- `/loans/search`: supported sort fields/directions, unsupported sort exclusions
  and specific filter/sort validation errors.
- `GET /invoices/reserved`: supported sort fields/directions, deterministic ties
  and documented cursor context binding; broader concurrent/context guarantees remain unverified.
- `POST /change-requests/search`: filter/operator/sort allow-lists, pagination,
  permissions, assignment scope and null-review semantics for status,
  resourceType, action, requestedBy/reviewedBy IDs/names and createdAt/reviewedAt.
- Reserved-invoice `receivedAt`: nullable RFC 3339 field, authoritative business
  timezone, date-only versus timestamp semantics, operators and validation.
  Its business meaning is confirmed as device receipt/claim of the reserved
  number, not physical receipt of an invoice or merchandise.

- Existing numeric bulk replay behavior and the selected future shared-trip
  model are different rollout stages. Document actual compatibility behavior;
  do not publish a future identity/trip guarantee as already deployed.
- Validate nullable single/plural embedded piece routes and positive uint32 item
  bounds, not only nullable catalog route and 1–200/unique array constraints.
- Preserve request/response envelopes, named capabilities, errors, operators,
  pagination, date/null semantics and examples through Swagger-to-Scalar conversion.
- Compare fresh served and generated schemas at the actual source revision
  using backend-owned tooling; no portal audit script is required. The earlier
  selected-declaration checks were not exhaustive validation or live acceptance.
- Portal owners re-audit schema metadata (F02) after authoritative publication
  and retain the loan-increase gate (F04) until deployed lifecycle acceptance.
  Domain teams own contract correctness; publication owners coordinate served parity.

For B09, required POST search additions are filters `settings.labelPrefix` on
`/branches/search`, numeric `barcodeSequence` and `deliverySequence` on
`/containers/search`, calendar `inspectionDate` and `registrationDate` on
`/vehicles/search`, and filter plus sort `postedAt` on both
`/inventory/receipts/search` and `/inventory/dispatches/search`. This is nine
capabilities (seven filters/two sorts), not a request to publish every previously
rejected candidate. Publish actual operators, errors and deterministic tie/null
semantics. Search OR combines with advanced filters using AND within access scope.

Reserved GET uses `data: {items, remaining, lowThreshold, nextCursor?}` while POST
search uses a flat `data` array and page metadata. `lowThreshold` is per-user and
zero is valid. `receivedAt` is nullable RFC3339 current device-claim time, cleared
when device assignment is removed. Date-only eq/neq compare the company business
day, gte starts at day beginning and lte includes day end; timestamps compare
instants. Nulls fail eq/gte/lte and are included by neq. Reject invalid/impossible
dates. Reviewed source uses company closeout timezone, default America/New_York;
confirm deployment. Cursor context binding/concurrent consistency remains unverified.

Loan increase `POST /loans/{id}/increases` requires requestId (nonzero UUID),
employee, sourceAccount and a positive finite cent-precision amount; optional
transactionDate/referenceNumber/description. Verify current named capability,
branch/employee/account eligibility and atomic principal/transaction/journal.
An authorized exact retry returns original transaction/journal with current loan,
even after period closure/later loan changes, with no effects. Changed-payload
UUID reuse conflicts; new requests pass current eligibility. The portal action
remains gated. Basic NY issue/increase/repayment and after-PAID
exact replay passed; after-period-closure, other-actor and fault/atomicity variants
remain unverified. Publication does not establish those remaining cases.

Additional future-target constraints: immutable company-unique printed piece
numbers never reused after delete/void; one daily route is one shared trip across
containers; batches join it. Preserve original shipping container and signed
receipts. Current numeric bulk replay may allocate another trip; document current
compatibility separately until identity/shared-trip migration is deployed.

Verify served [Scalar](https://api.embarqueros.com/scalar/openapi.json) and
[Swagger](https://api.embarqueros.com/swagger/doc.json) after rollout. Those
specifications were not fetched for this restructuring.

### Suggested action

#### API work

1. Correct nullable single embedded route and integral bulk item bounds at the
   source; regenerate. Positive uint32 means minimum 1 / maximum 4294967295,
   distinct from minItems=1, maxItems=200 and uniqueItems.
2. Publish the four absent operations and selected declarations, preserving
   permission/error descriptions, omission/null semantics, enums, operators,
   pagination and response envelopes through Swagger-to-Scalar conversion.
3. Remove stale clearance descriptions: reconciliation does not clear;
   clearance reconciles too and applies eligible deferred receipts exactly once.
4. Compare generated and served schemas semantically, then verify actual HTTP
   examples. Source, publication, runtime and portal acceptance are separate.
   Fetching specifications is a follow-up task, not something this edit performed.

#### Database work

No database migration is established by publication drift. Verify declared
persisted field types/nullability against each domain's implementation. Any
identity, shared-trip, financial or history migration remains owned by its domain;
do not change stored data merely to match an inaccurate schema.

#### Both — API and database together

1. [ ] Save source revision and fresh served Swagger/Scalar snapshots in the
   approved environment. Compare operations and resolved request/response schemas
   semantically; ignore key order, not absent constraints or changed wire shapes.
2. [ ] Verify the four listed operations and every operation/schema row above in
   source generation and served conversion. Correct nullable single-piece route
   and bulk item bounds at the source, then regenerate and validate the output.
   Positive uint32 items mean minimum 1, maximum 4294967295, separately from
   minItems=1/maxItems=200/uniqueItems and integral item type.
3. [ ] Confirm explicit null versus omission survives conversion for catalog,
   embedded single and plural pieces, alongside documented errors/permissions.
   Verify enum NOT_REQUIRED and remove stale reconciliation/clearance descriptions.
4. [ ] Compare declared request/response examples with actual authorized positive
   and negative HTTP controls. Source-schema presence, publication parity and
   business acceptance are separate results; list each independently.
5. [ ] Return schema excerpts, semantic differences, generation/validation commands
   and deployed evidence directly in Markdown. Portal tooling is optional, not a
   prerequisite. Portal owners re-audit table metadata against the API source
   reference after each pull.

Historical audit measured public/portal 297 paths, 350 schemas, 432 operations
against source Swagger 311 paths, 371 schemas, 448 operations. The saved audit
capture was November 14, 2026 at 01:51 UTC; earlier findings were November 13.
These totals are baselines, not a hard requirement that every future publication
have that size. The selected declaration audit was not exhaustive schema or runtime
validation, and no fresh specification was fetched for this documentation edit.

## Execution prerequisites and completion report

Use approved non-production fixtures. HTTP acceptance requires a real Firebase
JWT in `Authorization: Bearer <token>` plus `x-company-id: <authorized company>`.
Exercise the actual permissions and branch/assignment scope; direct service tests
and hidden UI controls do not prove HTTP enforcement. Preserve credentials and
personal data when preparing shared evidence.

For the reviewed database integration suites, use a disposable loopback MongoDB
replica set with `APP_ENV=codex`, `RUN_INTEGRATION_TESTS=true` and
`DATABASE_NAME=emsys_codex_test`. Inspect current fixture guards/cleanup and run
families serially. URI variables differ: journal/loan/change-request/route-policy
suites use `EMSYS_FINANCIAL_CONTROLS_TEST_URI`; delivery workflow/completion use
`EMSYS_WIZARD_MONGO_URI`; assigned invoice/pool use `EMSYS_INVOICE_SYNC_TEST_URI`;
customer deletion uses `EMSYS_CUSTOMER_DELETE_TEST_URI`; closeout/historical
reconciliation use `QUALITY_TEST_MONGO_URI` (closeout fixtures need empty branch/
settings collections); inventory posting uses `.env.codex` and `MONGO_URI` or
`MONGODB_URI` with its exact test-database guard. Insight timezone suites separately require `EMSYS_INSIGHT_TEST_URI`.
Use only the families relevant to this packet. Skipped tests must be reported. No backend suite was executed
in the portal source-review pass. External-service, retained-data and capacity
acceptance need their specifically authorized environments.

Return one Markdown report that includes the evidence itself, not dependencies
on portal files or inaccessible artifact links:

1. Original ID and scenario/variant, source commit, deployed revision/environment,
   execution date, database/server version and executed versus skipped tests.
2. Fixture setup, actor permissions, company/branch/assignment scope, exact request
   DTO/version/retry fields and sanitized request/response excerpts.
3. Expected versus actual outcome and pass/fail/blocked for every required case.
   Include persisted before/after values, dependent record counts, replay/race
   results, unchanged state after rejection and rollback/history evidence.
4. Fixes and regression results; distinguish local tests, deployed acceptance,
   schema publication and portal rollout. Include query plans/load/budgets where
   required rather than assuming a new index improves performance.
5. Remaining design questions with a concrete example and current source behavior.
   Ask the lead modeler before implementing an unresolved policy. Keep the ID open
   if required cases are failed, skipped or unresolved. A successful source test
   or publication check alone does not close persisted runtime acceptance.
