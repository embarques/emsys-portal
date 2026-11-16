# History, migrations, historical analytics and legacy integration

Standalone handoff. Restructured November 15, 2026; evidence remains dated
November 13–14, 2026. This edit adds no runtime verification or item closure.

Each ID uses **Issue → Expected result → Suggested action**, with actions split
into **API work**, **Database work**, and **Both — API and database together**.
API work covers commands, permissions, business rules and published contracts.
Database work covers persisted-state verification, indexes, seeds and migrations
where justified; verification does not automatically require a schema change.
Both covers atomicity, concurrency and acceptance across API and persisted state.
Portal work is explicitly assigned to portal owners rather than backend teams.

Scope: **I03, I05, I06; V13 legacy-closeout migration dependency**. All requirements and acceptance steps needed for this packet
are included here; recipients do not need other portal files. Source observations
refer to API revision `4fdef23abcbaa89778d9ea6ca2d8f28b633cd270`.
Backend source paths are optional pointers in the recipient's own repository.
Endpoint paths are relative to `/v1`. Confirmed defects, unverified scenarios and
proposed designs are different states. Previously passing cases are regression
controls, not newly open defects. Use actual backend DTOs; proposed shapes below
are explicitly labeled and must be published before integration.

## I03 — Persisted history and retained-data migration

### Issue

**Remaining verification and migration planning.** Commit/history ordering,
no success history after abort, tenant history indexes, retained pending/badge
migration and database/activity parity are not established across every writer.
Reversal readbacks retained fixture branch/closeout attribution, but are not
proof of database-history ordering. Portal invoice activity is synthetic from
create/payment/comment data and cannot certify system-wide persisted audit.

### Expected result

The API owns persisted audit/history. Portal invoice activity is synthetic from
invoice create/payment/comment data and is not a system-wide audit proof. Actor
IDs/names must be canonical on the server; do not depend on client repairs for
legacy numeric/email actor differences. Preserve original entity references and
unclassified legacy metadata rather than silently discarding it.

Operational daily-route attribution, supervisor financial responsibility and
physical/joint custody are independent. Route/crew edits must not rewrite retained
invoice/journal/manifest snapshots. Joint custody counts a batch once. Printed
merchandise numbers are immutable, company-unique and never reused after delete/
void; migrate historical selectors before removing numeric/ObjectID references.
Daily delivery route = one shared trip across containers is the agreed target;
current per-container legacy trip references need explicit compatibility mapping.

The lead modeler confirmed on November 14, 2026 that legacy closeout periods
must be handled separately through a one-time migration, not normal rollover.
Legacy uppercase OPEN period 4 remaining open after the NY rollover is not,
by itself, a rollover defect. This is separate from I04 account-chart migration
and I06 external legacy-service confirmation.

The API backend team should document eligibility/cutoff and status mapping,
historical totals and journal/receipt treatment, retained identifiers/dates/audit
associations, dry-run reconciliation, safe reruns/recovery and rollout ownership.
Do not identify migration scope solely from status casing or silently recalculate
history through ordinary rollover. The documented plan must be reviewed before
execution; no migration has been run or authorized by this review.

### Suggested action

#### API work

1. Inventory actual deletion, void/correct, reversal and critical-event writers
   and their activity API mappings. Canonicalize actor IDs/names on the server,
   preserving legacy metadata rather than requiring portal actor repairs.
2. Document the one-time legacy-closeout migration scope/cutoff, status/date
   mapping, historical totals, journal/receipt treatment, preserved associations,
   dry run, safe reruns/recovery and rollout ownership before review/execution.
   Ordinary rollover must not silently finalize legacy records.
3. Keep this migration separate from I04 chart migration and I06 remote legacy
   confirmation; no historical migration was executed or authorized here.

#### Database work

1. Inspect tenant history seeds/indexes and persistence for every real writer;
   verify attributable committed history and no success history after abort.
2. Plan retained-data repair only where needed. Preserve original identifiers,
   amounts/dates, balances, printed labels, signed receipts and audit associations.
   Do not infer eligibility solely from uppercase status casing.
3. Reuse `internal/customer/delete_integration_test.go`,
   `TestVersionedDeleteRecordsHistoryAfterCommit`, and
   `internal/financial_activity/integration_test.go`; test failure boundaries too.

#### Both — API and database together

1. [ ] Inventory actual history writers, tenant seed/index requirements and
   activity response mappings for deletion, void/correct, reversal and critical
   events. Run a positive control for each real writer, not a stubbed callback.
2. [ ] Insert barriers/failpoints before source commit and between dependent
   writes. Prove committed operations retain attributable history, while aborted
   operations leave neither domain effects nor success history. Document any
   outbox/recovery design and test delivery/retry semantics explicitly.
3. [ ] Compare database history with activity responses and source versions,
   financial balances and retained associations. Verify legacy pending PAYMENT
   rows, reversed/settled states and badge/queue exclusion before/after migration.
4. [ ] Retained production-data migration is needed only if old data must remain;
   disposable mock rows may be reset/reseeded. For retained data, prove reruns,
   counts/totals reconciliation and preservation of identifiers/receipts/audit.

The legacy-closeout plan requires dry-run counts/totals reconciliation, preservation
of original transaction dates/links and safe rerun/recovery evidence before rollout.
Period 4 remaining uppercase OPEN after NY rollover is not itself a rollover defect.

## I05 — Historical attribution and analytics reconciliation

### Issue

**Unverified retained-data parity.** Synthetic fixtures cannot certify actual
historical manifests or analytics across legacy invoice/journal snapshots,
movement, membership/supervisor changes, joint custody and timezone histograms.
No production mutation or wholesale reset is authorized by mock-fixture tests.

### Expected result

Reports reconcile to authoritative retained records without rewriting history
when routes or crews change. Operational route attribution, financial supervisor
responsibility and physical/joint custody remain distinct; each joint batch counts
once. Business-calendar weekday/month/rolling aggregates retain correct boundaries,
including midnight and DST, with explained void/legacy exclusions.

### Suggested action

#### API work

1. Verify list/detail/search/report mappings against retained snapshots and
   document timezone and exclusion rules. Do not use another derived report as
   the sole source of truth.
2. Reuse insight timezone, appointment-calendar and route-history tests; source
   presence is not execution or retained-data acceptance.

#### Database work

1. Select approved representative retained history or an authorized restored
   copy. Inspect original invoice/journal/manifest, movement and effective-dated
   membership/responsibility records.
2. Preserve snapshots and receipt/audit associations; investigate differences
   before proposing repair. No schema migration is assumed from this audit.

#### Both — API and database together

1. [ ] Select approved representative retained historical data, or an authorized
   restored copy, with legacy invoices/journals, route edits, piece movement,
   membership/supervisor changes and joint custody. Record source period/timezone.
2. [ ] Reconcile manifest membership and financial responsibility independently
   against retained snapshots; compare list/detail/search and report aggregates.
3. [ ] Verify business-timezone weekday/month histograms and rolling-period
   boundaries, including midnight/DST. Explain excluded/void/legacy cases and
   reconcile totals to authoritative records, not another derived API report.
4. [ ] Return sampled mappings and aggregate differences with reasons. Synthetic
   fixtures can validate logic but cannot certify production historical parity.

## I06 — Actual legacy-service confirmation and recovery

### Issue

**Unverified deployed integration.** Local legacy client/sync tests exist, but
an approved real legacy test service was not exercised. Confirmation failure,
success, uncertain-response recovery and no second remote call after committed
confirmation remain open.

### Expected result

Local pending/confirmed state matches actual remote effects. Failed or uncertain
outcomes follow an explicit supported recovery/idempotency policy; an already
committed confirmation does not call the remote service again. Concurrent retries
and missing mappings have documented, safe outcomes.

### Suggested action

#### API work

1. Use an approved legacy test service, current mapping DTOs and isolated
   fixtures; record local/remote IDs and actual call counts.
2. Confirm supported remote idempotency and recovery for timeout/uncertain results;
   do not infer those guarantees from mocked client behavior.
3. Reuse `internal/legacy-api/client_test.go` and sync tests, then validate the
   deployed protocol, errors and traces with credentials removed.

#### Database work

1. Inspect local pending/confirmed markers, original remote identifiers and
   retry state before/after each attempt and concurrent replay.
2. Verify a committed confirmation is durable and discoverable before any new
   remote call; define recovery for partial local/remote outcomes. A new schema
   or reset is not assumed without inspecting existing persistence.

#### Both — API and database together

1. [ ] Use an approved deployed legacy test service and isolated mapped fixtures;
   record local/remote IDs and baseline remote call count. No real confirmation
   service was exercised during the source-review pass.
2. [ ] Exercise confirmation failure, timeout/uncertain response and success.
   Inspect local pending/confirmed state and actual remote effects after each.
3. [ ] Retry/replay after failure and after committed confirmation. Prove already
   confirmed operations do not issue another remote call. Coordinate the supported
   remote idempotency/recovery policy for uncertain outcomes; do not assume it.
4. [ ] Include missing mappings and concurrent retries and return remote traces
   with secrets removed. Mock client tests alone cannot close deployed acceptance.

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
