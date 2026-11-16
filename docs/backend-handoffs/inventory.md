# Internal supplies, valuation and reconciliation

Standalone handoff. Restructured November 15, 2026; evidence remains dated
November 13–14, 2026. This edit adds no runtime verification or item closure.

Each ID uses **Issue → Expected result → Suggested action**, with actions split
into **API work**, **Database work**, and **Both — API and database together**.
API work covers commands, permissions, business rules and published contracts.
Database work covers persisted-state verification, indexes, seeds and migrations
where justified; verification does not automatically require a schema change.
Both covers atomicity, concurrency and acceptance across API and persisted state.
Portal work is explicitly assigned to portal owners rather than backend teams.

Scope: **V12**. All requirements and acceptance steps needed for this packet
are included here; recipients do not need other portal files. Source observations
refer to API revision `4fdef23abcbaa89778d9ea6ca2d8f28b633cd270`.
Backend source paths are optional pointers in the recipient's own repository.
Endpoint paths are relative to `/v1`. Confirmed defects, unverified scenarios and
proposed designs are different states. Previously passing cases are regression
controls, not newly open defects. Use actual backend DTOs; proposed shapes below
are explicitly labeled and must be published before integration.

## V12 — Inventory rollback, dispositions and responsibility

### Issue

**Remaining acceptance, not a reproduced general valuation defect.** The saved
15-check lifecycle passed: two ten-unit receipts at $0.50/$1.00 produced twenty
units valued at $15.00 (average $0.75). Invalid negative counts preserved closeout
version/status; matching close, exact replay, reasoned reopen and reclose retained
immutable older revisions. Injected mid-write failures, remaining dispositions,
permission/autoReconcile combinations and historical custody variants remain open.

The source competing-stock test is not a dependent-write fault-injection test.
Unsupported `postedAt` queries belong to B09; browser CORS/header failures belong
to F03 and do not establish a stock valuation defect.

### Expected result

Inventory means internal supplies, not customer merchandise. Keep physical
custody, operational daily-route attribution and financial supervisor accountability
separate. Joint custody is one batch counted once across `responsibleHolderIds`.
Stock, movements/outbox, dispositions and financial effects must be consistent,
replay-safe and attributable. Earlier closeout revisions remain immutable.

Preserve integer amount-minor units, zero/false, and omission versus explicit null
on partial updates. Receipt/dispatch search must use persisted `postedAt` rather
than receipt, dispatch or creation dates, with explicit unposted/null semantics.

### Suggested action

#### API work

1. Inventory the actual named create/update/reconcile grants and supported
   disposition/correction/payment commands; publish their DTO/version/If-Match and
   Idempotency-Key requirements. Do not invent save-progress or unpaid-sales
   approval endpoints.
2. Validate quantity, valuation, variance classification, reasoned reopen and
   responsibility changes with positive and denied permission controls.
3. Keep posting-date query rollout under B09 and explicit origin/header fixes
   under F03; verify real browser writes after platform deployment.

#### Database work

1. Inspect stock, valuation, movement/outbox, disposition, sale/obligation,
   payment, journal and revision records before/after each case.
2. Verify immutable revision/audit links, effective-dated membership, overnight
   retention and available/quarantined quantities. Identify required indexes or
   historical custody repair only from observed gaps.
3. Reuse `internal/inventory/posting_integration_test.go`,
   `TestInventoryPostingTransactionsAndConcurrentDispatch`; add actual mid-write
   failpoints rather than treating an insufficient-stock loser as equivalent.

#### Both — API and database together

1. [ ] Extend the two-cost fixture through sold, returned, damaged, lost, missing
   and stolen dispositions. Assert quantities/valuation and each sale/obligation/
   payment/journal effect, including no double-counted dispatch sale.
2. [ ] Inject failure between stock, disposition, movement/outbox, sale/obligation,
   payment and journal writes; prove complete persisted rollback and safe replay.
   A losing insufficient-stock race is not a mid-write failure injection.
3. [ ] Test concurrent dispatches and correction/payment allocation/release;
   verify immutable journal/audit links and no duplicate posting on exact retry.
4. [ ] Exercise valid create with autoReconcile off/on, with/without the actual
   standalone reconciliation grant; then denied CRUD fallbacks, responsible-party
   changes and grant revocation. A generic denied create proves neither grant path.
5. [ ] Cover remaining holder transfers, audited administrative reassignment,
   effective-dated membership and responsible-party changes. Verify overnight
   retention, available/quarantined counts and joint-batch reconciliation once.
6. [ ] Classify variances before close; reject invalid counts without state
   changes. Authorized reasoned reopening creates a new immutable revision; retain
   earlier snapshots. Test concurrent/replayed close and reopen requests.
7. [ ] Verify tenant/branch isolation with positive controls for each actor,
   permission-scoped list/read/write and more records than one lookup page.
8. [ ] Return exact named write/reconcile capabilities, payloads, before/after
   stock/financial states and per-disposition outcomes. Do not infer a grant from
   an endpoint description saying only “documented named capability”.

Receipt/dispatch posting filters and sorts must use persisted `postedAt`, not
receipt/dispatch/creation date; null/unposted semantics and deterministic ties
need query-owner acceptance. CORS currently omits `Idempotency-Key` on the tested
origin and blocks port 3100; platform owners must fix explicit origins/headers
before browser command acceptance. Backend atomicity is not established by that
configuration fix. Portal workflow activation remains separately gated; no
save-progress or unpaid-sales approval endpoint is asserted by this handoff.

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
