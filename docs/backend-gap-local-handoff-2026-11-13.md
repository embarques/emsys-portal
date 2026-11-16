# Backend gaps: local reference handoff — November 13, 2026

Scope: the remaining B, V and I items in [the gap tracker](backend-api-gaps.md).
The user selected **read-only API reference, portal fixes and backend handoffs**.
API source reviewed at `4fdef23abcbaa89778d9ea6ca2d8f28b633cd270`
(`Merge pull request #372 from embarques/feat/staff-complaint-workflow`).
The earlier [source review](backend-gap-source-review-2026-11-13.md) used
`675da5320b9ea6901b1223088579cd74a4d759e3`; its evidence remains historical.

No API code, database, deployment, permission seed or migration changed. No
authenticated business API requests or mutations were made. Later read-only
public specification and OPTIONS checks are recorded below. Test names below identify existing source to reuse;
they are **not passing test results**. No B, V or I item is closed by this pass.

## Portal correction delivered: B16 missing branch default

`createEmptyBranchSettings()` supplied `defaultLabelStatus: 1`, and the API
adapter reused that default for missing settings. A branch with no configured
status appeared configured; saving an unrelated edit could write the invented
status back. This is a portal gap within the broader B16 backend work.

- Use `0` as the existing API's unconfigured sentinel; do not infer status 1.
- Show “Not configured” in branch details and an empty status control with
  persistent English/Spanish setup instructions linked through `aria-describedby`.
- Preserve explicit zero, positive configured IDs and the legacy cased field.
- Keep the existing no-op edit comparison, request count, shared inputs and form
  state architecture. No extra catalog/directory requests were added.

The regression reproduces two failures before the fix, then passes all five
tests in [the branch adapter suite](../tests/unit/branch-optimizer-coordinates.test.mjs).
This does **not** validate administrator authorization, catalog membership or
stop every generation path. The API must enforce those invariants. Portal
`NEW_BARCODE_STATUS` fallbacks in `barcodes-api.ts` and `label-updater-api.ts`
also remain to be replaced with authoritative branch/catalog resolution across
their create/update/generate callers; do not remove them piecemeal and submit
unconfigured pieces silently.

## B items: ownership and next evidence

### Portal main-search alignment

The next portal batch aligns four main-search OR groups with the selected table
contract, using only fields already consumed by these adapters:

- Branches: `name`, `code`; contact/address/type remain advanced filters.
- Vehicles: `vehicleId`, `name`, `licensePlate`, `vin`; fuel, branch and actor
  criteria remain advanced filters.
- Containers: `name`, `containerNumber`, `booking`, `sealNumber`, `itn`;
  numeric IDs, amounts and dates are no longer sent as text `contains`. Broker,
  company and legacy `seal` remain available as explicit advanced filters.
- Supply items: `name`, `sku`; category remains an advanced filter.

The vehicle probe's main-search payload now matches the adapter. It was syntax
checked, not run against an API. Receipt/dispatch notes search is unchanged
pending deployment verification; vehicle dates, branch label prefix, container
sequences and inventory posting-time capabilities remain blocked by B09.
No layout, hook, query key, permission, pagination or sorting code changed.

The real adapters were executed against a recording central-client boundary
before and after the changes. Each sample sends search `NY`, page 3, limit 20,
sort `name:desc` plus the fixture's advanced filters. Reproduce with
`node --experimental-strip-types --test tests/unit/table-filters.test.mjs`.

| Sample / advanced filters | Main OR leaves before → after | JSON body bytes before → after | Requests before → after |
| --- | --- | --- | --- |
| Branch / type OFFICE | 7 → 2 | 587 → 290 | 1 → 1 |
| Vehicle / active false, year ≥ 2020 | 7 → 4 | 629 → 452 | 1 → 1 |
| Container / cost ≥ 0, departure date range | 12 → 5 | 1001 → 618 | 1 → 1 |
| Supply item / category BOXES | 3 → 2 | 348 → 292 | 1 → 1 |

These are serialized request-body measurements at a mocked HTTP boundary, not
network traffic, database plans, response sizes or latency measurements. They
demonstrate fewer predicates and smaller bodies, not a measured speedup.
The four new contract regressions fail before the correction and pass after it;
the suite also checks main OR under root AND, typed zero/false/date filters,
single paginated POST, idle GET/default ordering and explicit phone lookup.
The complete table-filter suite passes 13 tests. No live API behavior is certified.
For this search batch, the combined table-filter, branch-adapter and inventory-API
suites pass 29 tests. Focused ESLint and `npx tsc --noEmit --incremental false`
pass; the vehicle probe passes `node --check`. A fresh production build passes,
and full repository lint finishes with 0 errors / 100 warnings in the current
working tree. All selected main-search fields were checked against local API
source allow-lists; document references and `git diff --check` pass. No live API
requests, authenticated browser checks, commit, push or deployment were performed.

### Backend handoff status

| ID | Local finding / classification | Concrete next step |
| --- | --- | --- |
| B05 | Fresh public Scalar fetch matches tracked `api-docs.json` semantically; both omit four operations present in local Swagger. Local source also lacks two selected explicit declarations: embedded single-piece route nullability and bulk positive uint32 item bounds. | Correct/regenerate source declarations, verify served Swagger/Scalar conversion and publish, then refresh the portal's authoritative OpenAPI snapshot. Do not replace OpenAPI with Swagger 2 JSON or certify deployment from this clone. |
| B09 | Backend search capabilities: the selected nine filter/sort capabilities still need implementation. The inventory model has `postedAt`, but receipt/dispatch allow-lists omit it; vehicle model/write validation has due dates, but its query allow-list omits them. | Implement the five operations from the tracker with typed numeric/calendar/instant semantics, deterministic ties and scoped query-plan evidence. Align portal controls only against the accepted contract. |
| B12 | Backend command exists. Fixture account creation is not yet a demonstrated implementation defect: `prepareLeaf` requires an eligible layer-3 parent and explicit four-digit code; range `1300-1399` yields LOAN. F04's local requestId/session adapter is now prepared. | Build the parent/code/branch fixture correctly; run loan issue/increase/payment and exact replay after closure/state change. Extend the existing increase integration test for the selected policy before enabling the portal action. |
| B15 | Backend integrity defect: funding resolution canonicalizes the expense source, but not the expense classification `Account`; posting trusts submitted category metadata. | Resolve persisted category within tenant and eligible branch, require active posting EXPENSE and canonical metadata before writes. Cover ordinary create, sync, update and correction; invalid requests preserve balances, original entries and retry identity. |
| B16 | Mixed portal/backend/model work. Missing-default masking is corrected here. Backend generation can still return nil/ID-only default status, and arbitrary embedded status writes are server-owned. | Require valid branch configuration with administrator-only setting changes; enforce generation across all writers. Implement the already-selected atomic CONDUCE assignment / DEV-RD return contract and extension-preserving catalog behavior. Verify both catalog and embedded readbacks. |
| V06 prerequisite | Backend identity/model migration. Embedded sequence IDs can repeat between containers; existing bulk lookup is not container-scoped. User confirmed permanent non-reuse of printed numbers, including after deletion/void. | Implement the selected immutable company-unique printed-number identity, existing increasing sequence and one daily-route trip across containers. Audit legacy references and preserve signed/retry/history associations; no portal numeric-ID workaround. |

B15 rejection should use a genuine persisted EXPENSE positive control plus
forged ASSET, missing, inactive, non-posting, foreign-tenant and wrong-branch
negative controls. Rejection must occur before any ledger/receipt write. This
is a backend fix even if portal choices currently prevent most invalid input.

## V items: reuse tests before creating new harnesses

### B05 publication audit

Fetched only the unauthenticated public Scalar specification through a read-only
GET. No interactive docs operation, login, preview API, seed or mutation was run.
The [saved declaration audit](backend-gap-publication-audit-2026-11-13.json)
records UTC check time, input files, source revision, semantic hashes and counts.
The portal and published snapshots both have 297 paths, 350 schemas and 432
operations. Source Swagger has 311 paths, 371 schemas and 448 operations.
Its 16 additional operations are listed in the report; this includes the four
tracked missing operations and other changes outside B05's selected checks.

The audit checks 11 selected declarations. All 11 are absent/incomplete in the
published and matching portal snapshots. Nine are declared in local source;
the two remaining source corrections are:

1. `invoice.InvoiceDetail.barcode` references `core.Barcode`, whose `route` lacks
   explicit nullability. The plural form references `barcode.Barcode`, whose
   source route already has `x-nullable: true`; do not certify both forms from it.
2. Bulk `barcodeIds` has required/1–200/unique constraints in source, but its
   integer item schema lacks `minimum: 1` and `maximum: 4294967295`. Its prose
   mentions the positive uint32 range; this is missing schema declaration, not
   proof that runtime uint32 validation is absent.

The current published clearance prose still says it never changes reconciliation;
the source description records them together. Raw descriptions are retained for
human review, rather than marked correct through keyword matching. Remaining
allow-lists, envelopes, operators, error semantics and served conversion still
need their full B05 acceptance; this is not an exhaustive schema validator.

No OpenAPI file was changed: the portal snapshot is current with publication.
After backend correction/publication, fetch a new snapshot and rerun:

```sh
curl --fail --silent --show-error --max-time 30 https://api.embarqueros.com/scalar/openapi.json -o /tmp/emsys-current-scalar-openapi.json
node scripts/audit-openapi-publication.mjs --published /tmp/emsys-current-scalar-openapi.json --published-url https://api.embarqueros.com/scalar/openapi.json --source .reference/emsys-api/docs/swagger.json --source-revision 4fdef23abcbaa89778d9ea6ca2d8f28b633cd270 --output /tmp/emsys-publication-audit.json
```

Use the actual reviewed source revision on subsequent runs. Exit 0 means these
selected declarations and snapshot equality pass, 1 reports drift/missing
declarations, and 2 reports invalid input or arguments. The auditor itself is
offline and never sends requests. Do not overwrite the saved historical evidence.
Six unit/CLI tests pass, covering stale publication despite portal equality,
source omissions, hash key-order handling, x-nullable/required UUID declarations,
non-mutation, invalid input and meaningful exit codes. Focused lint and script
syntax pass. No application source changed in this batch, so application build,
TypeScript, browser and authenticated API tests were not rerun.

F02's existing `node scripts/audit-api-table-columns.mjs` was also run read-only.
It exits 1 with current table metadata drift, including lifecycle/version fields,
journal account/route/inventory metadata, catalog audit fields and report fields.
It also flags wire aliases and fixed-catalog/report assumptions needing review;
do not expose every missing field or remove working aliases just to make this
static audit pass. The subsequent F02 batch below addresses this local audit;
the earlier failure remains a before-change observation.

### F02 table metadata alignment

The [regenerated coverage inventory](api-table-field-coverage.md) now passes
`node scripts/audit-api-table-columns.mjs`: **26 table/catalog surfaces and 445
schema/compatibility fields** against the existing published snapshot. No OpenAPI
file or backend source changed. This does not certify newer unpublished source
models, live response parity, or completeness of every contextual/workflow table.

Added 76 explicit `column: false` declarations across 13 existing feature metadata
files, with intent comments. These include version/permission/lifecycle controls,
customs configuration, master-chart structure, operational attribution and raw
inventory confirmation/reconciliation/valuation data. They are deliberately not
new directory columns: typed feature models, actions and existing business
renderers retain their responsibilities. In particular, daily-route references
do not become another Received by/responsibility column, and raw inventory money
does not acquire generic formatting through schema discovery.

The audit now checks the shared payment fields against the actual Deposit,
ZellePayment and CreditCardPayment schemas independently. Only four exact
compatibility fields are exempted from extra-field drift, each with a recorded
reason: check/journal `checkNumber`, pickup `routeNumber`, and retired crew
`vehicle`. These exceptions do not substitute `orderNumber` or relax other
schema checks. The coverage helper still rejects missing, unknown and duplicate
fields and requires a nonempty reason for a compatibility allowance.

Employee title/department translation maps are explicitly not raw directory
columns. The Reports hub consumes `outputs` through PDF/Excel controls and
retains catalog enabled/sort/timestamp metadata in its adapter; the audit no
longer demands saved-report columns for those values. No report hub behavior,
catalog ordering, permission rule, form, request or mutation payload changed.

Layout evidence: compared every changed metadata array with base revision
`4eb5b28a1b0d6563f7a4b6989d430325f91f046e` using TypeScript transpilation and
filtering `column !== false`. **All 13 column-generating arrays are byte-for-byte
equal as serialized JSON before/after**, including aliases, default visibility,
date formats and sort declarations. No column storage key or renderer changed.
This establishes metadata equality, not a browser screenshot or render profile.

Focused checks cover the strict audit helper, typed journal version/action/zero/
false preservation without raw columns, independent payment-schema coverage,
report metadata/output normalization, existing column aliases and inventory
payload/version/confirmation behavior. The first three focused suites pass 24
tests; six additional translation-label checks pass (30 distinct focused tests
total). TypeScript, focused lint and production build pass. Full lint completes
with 0 errors / 100 warnings; the final coverage-helper hardening is also checked
by focused lint/tests. Inventory/handoff links and `git diff --check` pass. No live API or
authenticated browser acceptance was performed. F02 remains subject to re-audit
after B05 publication, including the currently missing published Loan schema.

### F03 authentication context and local origins

Local fixes preserve the Firebase identity / API authorization boundary:

- Redux transport stores actor identity and a monotonic `contextVersion` in
  addition to token/company. Actor/company/login/logout transitions change it;
  ordinary token rotation does not. This is client session metadata, not a
  server record version or permission decision.
- The central Axios instance binds each request to its originating version.
  It cancels on context changes during token lookup, on stale success/error
  responses, and before/after 401 refresh. An old request is not retargeted to a
  newly selected tenant or actor. Same-context 401 refresh still retries once;
  403 still never refreshes. Headers are rebuilt centrally, including deletion
  of stale Authorization/company headers and honoring `skipCompanyId`.
- The AuthProvider subscribes its TanStack Query client to context changes.
  All prior queries/mutations, including legacy unscoped cache keys, are cleared;
  active queries are canceled. Context-keyed child views reset observers/local
  state, preventing `keepPreviousData` from retaining old-company rows. Token
  rotation alone retains queries, mutations and the current view.
- Firebase identity callbacks reject older generations and ended contexts;
  scheduled/focus refresh and direct token lookup cannot restore a previous
  session. Explicit logout clears local identity/loading state immediately,
  before Firebase's asynchronous sign-out finishes. Dev bootstrap and manual
  sign-in are guarded against later context changes; canceled manual sign-in
  does not acknowledge success. Existing auth/bypass configuration is unchanged.

The browser regression reproduced a late auth callback installing
`token-logout-race` after local logout while the mocked Firebase sign-out was
still pending. The version guard fixes it. It also exercises competing user
callbacks, same-context token renewal, same-user company changes, rendered
`keepPreviousData`, refresh-after-logout, stale dev bootstrap after manual login,
and logout during dev initialization. This is the real AuthProvider/Redux/Query
integration with mocked Firebase, not a real Firebase or tenant sign-off.
The fixture also confirms a manually initiated dev sign-in interrupted by logout
rejects as canceled rather than reporting success to its caller.

Ten isolated unit controls use real Axios interceptors, Redux and TanStack Query
with an adapter boundary and no network. They cover context generation, header
replacement/removal, delayed token/401/success races, bounded 401 replay and 403
handling, full cache cleanup, and old pending queries not overwriting new data.
Three additional tests verify the existing local/remote/production proxy policy
and configured Next rewrite. No API base URL, proxy routing or environment
configuration was changed.

The [saved CORS controls](backend-gap-auth-cors-2026-11-13.json) are four
unauthenticated OPTIONS requests only:

| Origin / requested headers | Observed result |
| --- | --- |
| `http://localhost:3100` / Authorization + company | 403; origin not allowed |
| `http://127.0.0.1:3100` / Authorization + company | 403; origin not allowed |
| `http://localhost:3000` / Authorization + company | 204 with the matching allow-origin |
| `http://localhost:3000` / Authorization + company + If-Match + Idempotency-Key | 204, but allow-headers omits Idempotency-Key |

Backend handoff: explicitly support both approved port-3100 integration origins
and the existing inventory command's `Idempotency-Key` header. Keep origin scope
and API auth enforcement explicit. The local API middleware uses a hardcoded
allow-list that explains these findings. Next's external rewrite implementation
forwards request headers (changing Host does not remove Origin), so proxying is
not certified as a CORS fix for write requests. No proxy workaround or auth
relaxation was shipped. Verify corrected preflights in a fresh browser context
after deployment, then real authenticated read/write flows in an approved test
tenant. The OPTIONS `Access-Control-Request-Method: POST` header did not execute
a POST.

Remaining F03 acceptance: real Firebase login/expiry/logout, real authorized
company/actor transitions, deployed CORS/header support, and persisted workspace/
draft/filter scoping. This batch clears Query state and remounts views; it does
not redesign company selection, rewrite all feature query keys, erase persisted
workspace payloads, or certify every stored client context. Canceled responses
also do not undo a server mutation that already committed.

Validation during the batch: the full unit suite passes 601 tests. The isolated
provider browser fixture passes after the reproduced logout-race fix. TypeScript
and final production build pass. Full repository lint completed with 0 errors /
100 warnings; final provider/fixture changes also pass focused lint with one
existing provider effect warning. Document references, saved CORS JSON and
`git diff --check` pass. Earlier
sandboxed Chromium launch failed on macOS process-registration permission;
the same isolated test runs successfully with the required host permission.
No real credentials were used or written to artifacts, API source remains
unchanged, and no commit/push/deployment occurred.

### Portal loan-increase adapter

F04 is implemented locally within the existing feature hook and central Axios
boundary; the API clone remains read-only and `NEXT_PUBLIC_LOAN_INCREASE_ENABLED`
is unchanged. `increaseLoan(requestId, values)` now requires caller-owned operation
identity and sends the documented `requestId` UUID. The shared payload builder
preserves optional reference metadata and explicit empty strings.

The hook owns one local retry session, following the existing journal-create
session pattern. Identity includes company/user scope, loan and the exact wire
payload. An uncertain identical retry uses the original UUID and values snapshot;
in-flight identical submits share one request. Changed payload or scope gets a
different identity, while a later successful entry gets a fresh UUID. Automatic
mutation retries are disabled. Existing permission gates and cache invalidation
are retained; no additional directory or detail requests are introduced.

A missing loan or a response for a different loan throws a localized unconfirmed
error rather than closing the form as a successful null result. This retains the
retry identity and lets the existing form error handling preserve inputs. The
session is memory-only: unmount/reload recovery and durable identity are not
certified. Do not enable the feature based on these local checks alone.

The lifecycle and boundary runners now supply UUIDs. The lifecycle runner keeps
the original UUID for adapter retries and changed-payload conflict checks rather
than trying a new UUID after an uncertain response. Neither runner was executed
against a live API; historical evidence files remain unchanged.

Focused tests cover explicit request payload, lost response after simulated
commit, in-flight deduplication, company/actor/loan/payload isolation, returning to
an uncertain draft, fresh identity after success, missing/mismatched response,
schema validation and default feature gating. These are mocked-boundary controls,
not backend persisted lifecycle/replay/permission evidence. B12 and F04 activation
acceptance remain pending.

Validation for this batch: 17 focused loan-increase/payment-allocation/journal
session tests pass; TypeScript, focused ESLint, script syntax, translation keys,
document references and `git diff --check` pass. Production build passes. Full
repository lint has 0 errors / 100 warnings in the current working tree. No
authenticated browser or live backend lifecycle test was run.

### Existing API test sources

Paths in this table are relative to the local API's `internal/` directory.
The existing tests use database/service fixtures; HTTP grant enforcement and
the real portal payload must also be covered where the acceptance requires it.

| ID | Existing starting point | Remaining acceptance / classification |
| --- | --- | --- |
| V02 | `journal/financial_controls_integration_test.go`, `TestFinancialControlsIntegration`: closed-period settlement, mixed invalid batch, failed correction rollback and replay assertions. | Inject failure during settlement's dependent writes; prove no partial settlement/application/receipt. Existing failed correction is not settlement failure injection. |
| V05 | Same financial suite; `chart_account/model_test.go` protects system/BANK updates. | Fix B15, then add actual DB cases for inactive/non-posting/foreign accounts, child allocation and cash/expense correction paths. Unit protection checks do not prove persisted allocation. |
| V06 | `delivery/workflow_integration_test.go`, `TestDailyRouteBatchAndHistory` exercises seeded assignment/history. | A seeded numeric-ID fixture does not resolve the real adapter's collision/eligibility failure. Implement the selected number identity/trip contract, then test positive control, missing/foreign/delivered batches, atomicity and replay. |
| V07 | Same workflow file: `TestCatalogAssignmentFeedsDeliveryCompletion`, `TestEmbeddedAssignmentFeedsDeliveryReview`, `TestCompletionAndDailyRouteAssignmentRace`, `TestLegacyInvoiceOnlyPieceRouteRemoval`. | Reuse race/legacy fixtures, but first align B16 and the selected shared-trip model. Prove nonempty membership, status, return/reassignment and preserved shipping provenance. |
| V08 | Same workflow file: `TestInvoiceDeletionVersionDocumentsAndDependents` checks stale versions, documents and dependent piece deletion. | It does not assert full linked financial/audit retention. Extend with paid/void/reversed journals, receipts and direct persisted history evidence. |
| V09 | `customer/duplicate_test.go`, `address_migration_test.go` and `delete_integration_test.go` cover adjacent duplicate/migration/history behavior. | Create legacy duplicate identities directly in an isolated fixture; address-only edits must preserve identity and linked history. Ordinary validated creates cannot manufacture this legacy case. |
| V10 | `invoice/assigned_create_integration_test.go`, `TestAssignedInvoiceAndPaymentTransactionsIntegration`; `handler_integration_test.go`, `TestCreateInvoiceEndpointIntegration`. | Run these, then map each assertion to unpaid completion, own/foreign pickup/customer, replay/revocation, initial payment, branch 11 and `receivedBy`. Do not reuse pickup-only results as invoice proof. |
| V11 | `delivery/completion_balance_integration_test.go`: balance/tampered values, outstanding canonical journals, query plans and concurrent financial write checks. Workflow suite covers scope, optional photos and authorization rechecks. | Run with actual CONDUCE and current contract; extend any missing policy/photo-owner/multiple-actor cases. Current single-container assumptions must change for the selected shared trip. |
| V12 | `inventory/posting_integration_test.go`, `TestInventoryPostingTransactionsAndConcurrentDispatch`: competing stock dispatches and absence of losing movements/outbox. | A losing insufficient-stock dispatch is not an injected mid-write failure. Add failpoints for dependent financial/stock writes and disposition/valuation/grant/autoReconcile combinations. |
| V13 | `income_statement/end_of_day_integration_test.go`, `TestExplicitCloseoutRolloverIntegration`: explicit creation/concurrency and legacy closed-row cases. | Existing test uses current time; add controllable closeout clock cases for STALE_OPEN_CLOSEOUT/LATEST_CLOSED and transaction membership across midnight. Route-clock tests are a different invariant. |
| V14 | `invoice/reserved_integration_test.go`, `TestReservedInvoicePoolTransactionsIntegration`; `reserved_search_test.go`. | Add two-tenant/branch/filter-bound cursors, concurrent tie mutations and non-null device-claim timestamps around business midnight. Null-only fixtures do not prove boundaries. |
| V15 | `change_request/workflow_integration_test.go`, `TestChangeRequestWorkflowIntegration`: domain failure/retry and cached-role revocation. | Complete resource-specific approval/VOID actions and cross-tenant/branch matrix; use distinct actors plus commit-window barriers. A stubbed domain application is not proof of every resource's correction. |

## I items: implementation evidence versus environment evidence

| ID | Local starting point | What still requires backend execution / design |
| --- | --- | --- |
| I01 | Delivery workflow's `TestDailyRouteBusinessMidnightRollback` injects a route clock crossing during bulk/embedded writes; invoice handler suite has `TestCreateInvoiceRollsBackWhenInvoiceDetailsFail`. | Run and extend the dependent-write failure matrix, including pickups and completion/movement races. Align expectations with number identity/shared trips before certification. |
| I02 | `TestDeliveryCompletionRechecksActiveAuthorization` has grant and crew cases; change-request integration covers revoked role. | Establish barriers at commit, distinguish cache invalidation from in-flight authorization, and measure guarded throughput/latency. Do not infer commit locking from a pre-action revoked grant. |
| I03 | `customer/delete_integration_test.go`, `TestVersionedDeleteRecordsHistoryAfterCommit`; financial suite checks reversal/correction; `financial_activity/integration_test.go` covers historical reconciliation fixtures. | Persisted history after success alone does not establish ordering/no-history-after-abort for every writer. Add failure assertions, migration fixtures and pending/badge exclusion; reconcile direct history and activity API. |
| I04 | `chart_account/repository_test.go`, `TestChartAccountAllocationReservesSystemIDs` uses a mocked Mongo client; `prepareFundingChild` contains ancestry/cycle/range rules. | Use real DB occupied/exhausted/concurrent code allocation, deep/cyclic/foreign parents and legacy/historical posting fixtures. Mock numeric-ID allocation is not bank-code concurrency proof. |
| I05 | `insight/timezone_integration_test.go`, `appointment_calendar_integration_test.go` and route history fixtures provide pieces of the matrix. | Production manifest/analytics reconciliation needs authorized representative historical data. No local synthetic result can certify that production reconciliation. |
| I06 | `legacy-api/client_test.go` and sync tests provide client/mapping starting points. | Use an approved legacy test service for confirmation failure/success, retry and no repeated confirmed remote call. No live legacy confirmation was attempted here. |
| I07 | `authz/route_policy_integration_test.go`, `TestRoutePolicyScopeAndQueryPlanIntegration`; delivery balance and assigned-list performance tests; invoice pool/mobile list plan fixtures. | Run existing plan/command-count assertions, then benchmark representative approved data and scoped budgets. Small fixture tests are not broad capacity proof. B09's new fields need their own plans. |
| I08 | Vehicle write validation requires `YYYY-MM-DD`; reserved pool exposes a per-user threshold. Date storage and threshold metadata do not establish alert delivery. User selected a 10-calendar-day lead time, vehicle-read-permission audience, red Vehicles sidebar badge, vehicle table alerts and notification inbox entries. | Implement server evaluation/counts within authorized company/branch vehicle scope across all three surfaces; verify 11 days (not due soon), 10 days (due soon), due today and overdue. Business timezone and implementation still need verification. Do not scan only the first 200 vehicles or add per-vehicle requests. |

I08 vehicle policy confirmed by the lead designer: alert users who have vehicle
read permission starting 10 calendar days before inspection/registration is due.
Use the API's authoritative `vehicle:view` grant and record scope; the reviewed
vehicle list/search/detail routes use that resource/action. Do not infer alert
access solely from the portal's legacy pickup-view navigation alias. Losing read
access must remove alert access. The policy is recorded; no alert implementation
or live permission/date-boundary verification was performed here.

Display surfaces subsequently confirmed: a **red Vehicles sidebar badge**, alerts
in the **vehicle table**, and the **notification inbox**. Apply the same vehicle
read permission, record scope and date eligibility to each surface. Backend
evaluation/counts and inbox delivery remain implementation work; no notification
endpoint or payload is inferred from this decision.

Printed-barcode retention subsequently confirmed: never reuse a number for
different merchandise, even after its original piece is deleted or voided.
**Backend clarification November 16:** keep the existing increasing sequence.
Deletion leaves its counter unchanged, so subsequent allocations move forward and
deleted numbers stay retired. The reservation-table proposal is withdrawn.
Remaining checks are that imports/reseeds preserve the counter, including deleted
high numbers, and concurrent allocations advance it atomically. Reprints and exact
retries for the same piece keep the existing identity. These checks remain pending;
the clarification does not establish new runtime evidence or complete the separate
identity/index migration.

## Local execution prerequisites

Environment inspection found no `go` or `mongod` on PATH. Docker CLI is installed,
but `docker version` cannot connect to the daemon. Therefore no backend unit,
integration, formatting, vet, database-plan or load check was run. The API clone
remains unchanged; installing/running a backend was not part of this reference pass.

For the backend handoff, use a disposable loopback MongoDB replica set and
`APP_ENV=codex`, `RUN_INTEGRATION_TESTS=true`, `DATABASE_NAME=emsys_codex_test`.
Review each fixture's guard and cleanup before executing it. Test families read
different URI variables:

| Test family | URI/config prerequisite |
| --- | --- |
| Journal financial controls, loan increases, change requests, route policy | `EMSYS_FINANCIAL_CONTROLS_TEST_URI` |
| Delivery workflow and completion balance | `EMSYS_WIZARD_MONGO_URI` |
| Assigned invoices and invoice pool | `EMSYS_INVOICE_SYNC_TEST_URI` |
| Closeout rollover and historical reconciliation | `QUALITY_TEST_MONGO_URI`; closeout fixture requires empty branch/settings collections |
| Customer deletion history | `EMSYS_CUSTOMER_DELETE_TEST_URI` |
| Inventory posting | `.env.codex` plus `MONGO_URI` or `MONGODB_URI`; exact test database guard |

Run families serially in an isolated test environment; do not point every suite
at a shared development tenant and assume fixtures cannot conflict. Record
executed versus skipped tests, revision, database/server version and exact
acceptance evidence before changing any tracker's closure status.

Recommended order: B15 financial integrity; B09 typed searches/publication;
B12 fixture/replay plus gated F04 adapter; B16 configuration and the shared
identity/trip work; then the affected V/I acceptance suites. Historical,
legacy-service and capacity sign-offs retain their separate evidence needs.

## Portal validation

- Branch adapter suite: 5 passing tests; before the correction, the two new
  missing-configuration regressions failed with `1 !== 0`.
- `npx tsc --noEmit --incremental false`: passed.
- Focused ESLint: no errors, one existing branch-form effect warning.
- Full `npm run lint`: passed with 0 errors and 100 warnings in the current
  working tree, which includes pre-existing unrelated changes.
- `npm run build`: passed after rerunning outside the sandbox; the first attempt
  could not bind Turbopack's worker port (`Operation not permitted`).
- English/Spanish keys, every tracker B/V/I ID in this handoff, relative links
  and `git diff --check`: passed. No authenticated browser/API E2E was run.

Work is local on `fix/backend-gap-verification-followups`; no commit, push,
merge or deployment was performed. Existing unrelated work was preserved.
