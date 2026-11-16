# Authorization, approvals, tenant isolation and integration origins

Standalone handoff. Restructured November 15, 2026; evidence remains dated
November 13–14, 2026. This edit adds no runtime verification or item closure.

Each ID uses **Issue → Expected result → Suggested action**, with actions split
into **API work**, **Database work**, and **Both — API and database together**.
API work covers commands, permissions, business rules and published contracts.
Database work covers persisted-state verification, indexes, seeds and migrations
where justified; verification does not automatically require a schema change.
Both covers atomicity, concurrency and acceptance across API and persisted state.
Portal work is explicitly assigned to portal owners rather than backend teams.

Scope: **F03 (backend), V15, I02**. All requirements and acceptance steps needed for this packet
are included here; recipients do not need other portal files. Source observations
refer to API revision `4fdef23abcbaa89778d9ea6ca2d8f28b633cd270`.
Backend source paths are optional pointers in the recipient's own repository.
Endpoint paths are relative to `/v1`. Confirmed defects, unverified scenarios and
proposed designs are different states. Previously passing cases are regression
controls, not newly open defects. Use actual backend DTOs; proposed shapes below
are explicitly labeled and must be published before integration.

## F03 — Approved integration origins and required headers

### Issue

**Confirmed configuration gap.** OPTIONS returned 403 for
`http://localhost:3100` and `http://127.0.0.1:3100`. Port 3000 returned 204 with
allow-origin, but allowed headers omitted `Idempotency-Key`, required by existing
inventory commands. A successful status alone does not prove valid preflight.

### Expected result

Approved origins can send authenticated versioned/idempotent commands with
Authorization, x-company-id, If-Match and Idempotency-Key. Exact origin scope,
tenant isolation and permissions remain enforced. Actual browser commands pass
positive and negative controls after deployment.

Portal transport/cache/provider race fixes are already implemented and mock-tested.
Real Firebase and stored workspace/draft/filter isolation remain portal acceptance.

### Suggested action

#### API work

1. Configure the two approved port-3100 origins and required headers explicitly.
   Preserve all auth/company/grant checks. A proxy forwarding headers does not by
   itself resolve Origin enforcement.
2. Re-run fresh method/header-specific preflights and actual authenticated browser
   reads/writes; report allowed values as well as status codes.

#### Database work

No database change is established by this CORS defect. Do not alter user grants,
tenant records or command persistence to work around an origin/header failure.

#### Both — API and database together

1. [ ] On the intended API test host, send OPTIONS controls for
   `http://localhost:3100`, `http://127.0.0.1:3100` and `http://localhost:3000`.
   Request the actual write method and Authorization, x-company-id, If-Match,
   Idempotency-Key headers. Historical first two returned 403, port 3000 returned
   204; a 204 header control still omitted Idempotency-Key.
2. [ ] Explicitly allow approved integration origins and required headers;
   preserve exact origin scope and all auth/tenant/grant enforcement.
3. [ ] Repeat preflight and real authenticated browser reads/writes; verify
   actual allowed-header/origin values, successful valid commands and denied
   unauthorized commands. Proxy header forwarding alone is not an Origin fix.

## V15 — Remaining resource and approval actor combinations

### Issue

**Unverified variants.** Historical disposable-actor pickup UPDATE controls
passed submission/replay, rejection, authorized self-approval, repeat-review
conflict, pending-source direct-write lock, stale submission, same-token reviewer
revocation and assigned/crew revocation. These do not certify pickup VOID,
invoice/journal/barcode/inventory corrections, other reviewers or live cross-company/
branch isolation. Stubbed domain application does not establish each real writer.

### Expected result

Firebase identifies the actor; the API determines grants, tenant/company, branch
and assignment. Protected writes require their documented request/review workflow,
not merely a legacy CRUD grant. Source and request/audit effects must commit
atomically; submission and rejection leave source state unchanged. Approval
rechecks current grants, assignment and source version. Closed-period corrections
must not reopen history. Authorized self-approval is a supported tested case;
self-approval is not automatically allowed for every reviewer.

### Suggested action

#### API work

1. Enumerate actual supported resource/action/grant combinations for distinct
   submitter, assigned employee, supervisor, reviewer and authorized-self actors.
2. Apply current grant, assignment, source-version and pending-request checks to
   every real correction/void implementation; expose unsupported combinations
   explicitly instead of assuming all generic routes are equivalent.
3. Exercise list/search/detail/write with changed IDs, filters/pages and company/
   branch headers, preserving valid positive controls and foreign-data isolation.

#### Database work

1. Verify source/request/audit changes commit together; submission and rejection
   do not mutate the source. Inspect failure, stale-version and replay state.
2. Reuse `internal/change_request/workflow_integration_test.go`,
   `TestChangeRequestWorkflowIntegration`; extend real resource writers beyond
   stubbed application and check history/financial links directly.

#### Both — API and database together

1. [ ] Use distinct submitter, assigned employee, supervisor and management/
   reviewer identities with explicit grants, plus denied and authorized-self
   controls. Inventory actual target IDs, version formats and allowed update fields.
2. [ ] For pickups, invoices, journals, barcodes/labels and inventory dispatches,
   exercise create/read/request_update/request_void/review/update/void as supported.
   Include pickup VOID. Return unsupported resource/action combinations explicitly.
3. [ ] Prove pending-source locks, stale version rejection, unauthorized review,
   authorized self-approval policy, rejection without effects and concurrent
   approval applying once. Inject dependent domain/request/audit failures.
4. [ ] Vary record IDs, filters/pages, company/branch headers and assignments on
   list/search/detail/write. Denials must not expose foreign data or mutate either
   eligible or ineligible records; test the actual resource implementation.

## I02 — Authorization and crew changes before commit

### Issue

**Unverified commit windows and capacity.** Existing revoked-role/grant and crew
controls do not prove behavior when authorization changes after a request starts.
Controlled barriers and representative guarded-write measurements were unavailable;
source tests were located but not executed.

### Expected result

API writes honor a documented ordering/locking policy for authorization and
membership changes through commit. Grant/role and crew-membership windows are
separate cases. Rejections leave no partial domain, request or audit effects.
Correctness and tenant isolation remain intact under representative load.

### Suggested action

#### API work

1. Add controlled barriers after initial authorization/membership reads and
   before commit. Establish the intended ordering policy with owners and test
   both revocation/commit orders.
2. Reuse `TestDeliveryCompletionRechecksActiveAuthorization` and revoked-role
   change-request tests; distinguish fresh denied requests from in-flight cases.

#### Database work

1. Inspect the transaction/lock boundaries protecting user, role, grant and
   crew reads through commit; assert no partial domain/request/audit effects.
2. Measure lock duration, contention and the query plans used by guarded writes.
   A new index is justified only by actual plans and representative measurements.

#### Both — API and database together

1. [ ] Install controlled barriers after initial grant/membership reads and before
   commit. Revoke role/grant in one case and crew membership in another.
2. [ ] Establish and document the intended ordering/locking policy with owners;
   verify both revocation/commit orders and no unauthorized partial effects. Fresh
   post-revocation requests and cache invalidation do not prove this invariant.
3. [ ] Measure guarded write throughput/latency and lock duration/contention under
   representative non-production load; compare with existing budgets and baseline.
   Preserve isolation/correctness rather than removing guards to improve timing.

Portal boundary: actor/company changes clear old queries/mutations and reset
observers; ordinary token renewal retains them. Local transport/cache/provider
race controls are implemented/mock-tested, not real Firebase acceptance. Backend
owns CORS and API authority; portal owners separately verify login/refresh/logout,
company switching and stored workspace/draft/filter isolation in a real browser.

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
