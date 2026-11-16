# Vehicle compliance and low-pool alerts

Standalone handoff. Restructured November 15, 2026; evidence remains dated
November 13–14, 2026. This edit adds no runtime verification or item closure.

Each ID uses **Issue → Expected result → Suggested action**, with actions split
into **API work**, **Database work**, and **Both — API and database together**.
API work covers commands, permissions, business rules and published contracts.
Database work covers persisted-state verification, indexes, seeds and migrations
where justified; verification does not automatically require a schema change.
Both covers atomicity, concurrency and acceptance across API and persisted state.
Portal work is explicitly assigned to portal owners rather than backend teams.

Scope: **I08**. All requirements and acceptance steps needed for this packet
are included here; recipients do not need other portal files. Source observations
refer to API revision `4fdef23abcbaa89778d9ea6ca2d8f28b633cd270`.
Backend source paths are optional pointers in the recipient's own repository.
Endpoint paths are relative to `/v1`. Confirmed defects, unverified scenarios and
proposed designs are different states. Previously passing cases are regression
controls, not newly open defects. Use actual backend DTOs; proposed shapes below
are explicitly labeled and must be published before integration.

## I08 — Vehicle compliance and low-pool alerts

### Issue

**Incomplete implementation/integration and remaining verification.** The portal's
seven-day warning was corrected locally to the confirmed ten days; inspection and
registration 10/11-day controls passed. Full server evaluation/counts, the red
Vehicles sidebar badge and agreed inbox lifecycle remain open. The current portal
hook uses a maximum-200-vehicle snapshot and operator-local day, so it cannot
establish fleet coverage or business-calendar correctness. Vehicle date search
fields still reject live requests.

Low-pool threshold metadata and selected reservation-grant controls passed, but
notification delivery, multi-user scope, recovery and deduplication remain unproven.

### Expected result

- Inspection and registration alerts start **10 calendar days before** their due date.
  Verify 11 days (not yet due soon), 10 days, due today and overdue on the authoritative
  business calendar. Verify the timezone rather than using browser-local instants.
- Audience is users with **vehicle read permission (`vehicle:view`)**, limited
  to their authorized company/branch vehicle scope. Do not use the portal's legacy
  pickup-navigation alias as the alert authorization rule. Revoked read access
  must remove alert access.
- Support consistent eligibility/count data for a **red Vehicles sidebar badge**,
  alerts in the **vehicle table**, and entries in the **notification inbox**.
  No endpoint or payload shape has been invented for those surfaces.
- Cover the full directory with server evaluation/aggregation. Avoid first-200
  vehicle scans, whole-directory downloads and per-vehicle portal requests.

- Low-pool alert implementation/verification remains I08 scope. The selected
  10-day window above is a vehicle policy, not a reservation-count threshold.
  Existing per-user low-threshold metadata alone is not notification delivery proof.
- B09 vehicle date queries are owned by search/performance.
  Reservation cursor/date/isolation acceptance is owned by
  customers/invoices.
- Backend owns authoritative evaluation, access scope, counts and inbox delivery;
  portal owns rendering the agreed badge/table/inbox surfaces after a published
  contract is ready. Coordinate that work through portal follow-up.
- Return complete-coverage, date-boundary, grant-revocation and tenant/branch
  evidence and publish the final contract through B05.

### Suggested action

#### API work

1. Publish actual alert/count/inbox DTOs and grants; no endpoint or payload is
   assumed here. Evaluate the full authorized directory server-side without fleet
   downloads, first-page limits or per-vehicle requests.
2. Implement inspection/registration eligibility at ten calendar days, due today
   and overdue using an authoritative business timezone. Enforce `vehicle:view`
   and company/branch scope consistently across counts, lists and inbox.
3. Confirm count grouping (vehicles versus due events), read/dismiss/deduplication
   rules and low-pool trigger/audience/recovery policy with the modeler before
   implementing unspecified behavior. Ten days applies only to vehicle alerts.
4. Publish vehicle date filter operators and errors separately under B09; storage
   validation alone does not establish search or notification support.

#### Database work

1. Verify stored YYYY-MM-DD dates, per-user `lowThreshold` (including zero),
   device-claim lifecycle and the indexes needed for complete scoped evaluation.
2. If notification persistence or evaluation checkpoints are introduced, define
   durable event identity, tenant/user ownership, retention and retry recovery.
   Do not infer an existing collection or require a migration without inspection.

#### Both — API and database together

1. [ ] Establish the authoritative business timezone and evaluation clock; record
   calendar-date handling for `inspectionDate` and `registrationDate` (writes
   validate YYYY-MM-DD). Do not use browser-local instant arithmetic for days.
2. [ ] Define and publish the actual server alert/count/inbox DTOs and grants.
   No endpoint or wire shape is selected here. Evaluate the entire authorized
   directory server-side, including vehicles beyond the first 200; avoid fleet
   downloads, per-vehicle calls or fixed-page coverage.
3. [ ] Implement the confirmed vehicle policy for both dates: alert at 10 calendar
   days before due, due today and overdue; 11 days is not due soon. Restrict all
   results to users with `vehicle:view` and authorized company/branch scope.
4. [ ] Provide consistent eligibility for the red Vehicles sidebar badge, vehicle
   table alerts and notification inbox. Determine/document whether counts group
   vehicles or individual due events, and the read/dismiss/deduplication lifecycle
   with the modeler; display surfaces alone do not settle those policies.
5. [ ] Add fixtures at 11 days, 10 days, midnight, due today and overdue, plus
   missing dates, date correction, access revocation, branch/company change and
   more than 200 vehicles. Verify all three surfaces have the same authorized
   eligibility and do not leak prior-context entries.
6. [ ] Implement/verify low-reserved-number alerts separately. The pool has a
   per-user `lowThreshold` preference; zero is valid, and a matching metadata
   readback is not notification proof. Confirm the trigger comparison, audience,
   reset/deduplication and inbox policy before implementation if unspecified.
7. [ ] Exercise low-pool crossing and recovery with multiple users/companies,
   permission removal and pool claim/return/allocation changes. Unused numbers
   are not customer invoices or financial totals. Device-claimed numbers must be
   returned before reassignment; reservation `receivedAt` is device claim time.
8. [ ] Return full-coverage/count/date/access evidence and notification effects,
   including replay/evaluation deduplication. Distinguish backend evaluation from
   portal rendering and real end-to-end acceptance.

Vehicle date query support is separate B09 work: POST `/vehicles/search` must
support explicit inspectionDate/registrationDate filters with documented calendar
semantics and invalid-date rejection. These filters are absent from reviewed
source allow-lists; stored dates alone do not establish query or alert support.
Do not add an assumed alert endpoint or silently treat a 10-day vehicle lead time
as a reservation-count threshold. Backend publishes actual contracts; portal
renders the agreed sidebar/table/inbox after rollout.

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
