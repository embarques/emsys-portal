# Independent invoice and payment responsibility — 2026-11-19

The user's confirmed policy supersedes the shared invoice/INITIAL-PAYMENT party
assumption in API [PR #388](https://github.com/embarques/emsys-api/pull/388) at
`ad7cefcb963597fbfc1e1482c70dff107255b59e` and Portal commit `3f572a2f`.
The current local change is based on Portal `1de8abd737df7a0d1050a778990958741e22d113`.
The API follow-up head `21fd96f5915db0c05dcb1a1137945f127fcd7e58` merged through
PR #388 into API dev as `7f3ed8cfda89775b766d9a6c627ba7ae59b52544` on
2026-11-19. GitHub pickup checks passed, including disposable MongoDB pickup
regressions. The user authorized delivery of the companion Portal changes to dev.
A merge is not verified deployment or authenticated responsibility acceptance.

## Confirmed behavior

- Invoice responsibility is the merchandise employee/supervisor and optional NY
  daily route. Selecting a route derives and stores its supervisor as an employee
  entity. `createdBy` remains the digitizing user. Legacy invoice `driver` is a
  supervisor compatibility read, independent of payment collection.
- `canAssignInvoiceResponsibility` controls merchandise assignment;
  `canAssignPaymentResponsibility` controls every payment collector, including
  INITIAL-PAYMENT. Exact permission name/resource pairs are required. Legacy
  name-only matching cannot grant these capabilities; CRUD remains separate.
- Without the matching grant, new assignment defaults to the unique active
  linked employee. A route without delegation authority is eligible only when
  self is its responsible supervisor. The API validates links and tenant scope.
- The wizard prefills the collector from the invoice when payment assignment is
  authorized, then permits a different employee or route. Explicit choices and
  entered amounts survive directory refreshes and backward/forward navigation.
  The navigation snapshot comes from the React Hook Form subscription.
- Payment changes never overwrite the invoice. Invoice completion saves its own
  party, and later invoice changes leave committed payments untouched. The Daily
  Income invoice-registration form also offers separate merchandise/collector
  controls and a review of both assignments. English and Spanish copy is aligned.
- API posting accepts merchandise choice through
  `invoice.responsibility: {employee: {id, name}}` or
  `invoice.responsibility: {dailyRouteId}`. The journal's existing top-level
  employee/route fields select the collector. Omitted selections resolve linked
  self independently. The Portal implements the convenience default explicitly.
- Canonical invoice writes accept `supervisor` employee IDs and optional
  `dailyRouteId`, retaining `receivedBy` compatibility. The API resolves employee
  data and route supervisors; submitted names never establish authority.
- Invoice reassignment appends a transactional audit event with old/new supervisor
  and route, actor and timestamp. Existing journal financial edits retain their
  before/after audit. A payment edit without assignment authority preserves its
  existing collector instead of silently transferring accountability to self.
- An unchanged invoice route retains its captured supervisor on completion/edit.
  Financial lifecycle locks remain: this does not create a general edit path for
  INITIAL-PAYMENT, cleared, reconciled or otherwise restricted history.
- Existing balanced posting, clearance, totals, duplicate protection and replay
  rules remain in force. Responsibility changes do not post money or recognize
  revenue. Company payment-reference lookup remains narrow; browsing authority
  and cross-company access are unchanged.

## API delivery

The coordinated API changes were committed as `178294f` in the isolated checkout
`/tmp/emsys-api-pr388-policy`. Current API dev at `d602445` was integrated and
verified in `21fd96f`, then pushed to #388's existing feature branch.
The existing `.reference/emsys-api` checkout and its user changes were untouched.
The merged source and validation record are available on
[API #388](https://github.com/embarques/emsys-api/pull/388).

Tests of the former shared-party rule were retained for the common workflow but
now supply explicit matching invoice and collector selections. New regressions
cover different employees, different routes, all four grant combinations,
missing-link failure before writes, unchanged snapshots and reassignment audit.
The payment permission expectation was updated because the user explicitly
changed the INITIAL-PAYMENT policy. No assertions were weakened to hide failures.

## Validation and limits

Portal focused policy, payload, permissions, assignment and account tests:
**90 passed**. Focused browser tests: **19 passed**, covering separate grants,
mobile/desktop choices, production payment-form defaulting, draft preservation,
and keyboard navigation. After the draft initialization adjustment, the two
payment-form cases passed again. The fields in that production-form fixture are
replaced by small test controls; API hooks are mocked and no live requests occur.

Full Portal unit run: **667 passed, six failed**. These are the same six failures
previously documented on unchanged baseline: the Daily Income filter loader,
the no-closeout start-display assertion, and four delivery-display loader tests.
No failing assertions were removed. Final `npx tsc --noEmit --incremental false`
and `npm run build` passed. Final `npm run lint` passed with zero errors and
110 existing warnings; the new warnings encountered during implementation were
resolved rather than suppressed. `git diff --check` passed.

API checks passed: `go fmt ./...`, `go vet ./...`, `go build ./...`,
`go test ./...`, `make swagger` (including served Scalar parity), and
`go test -race ./internal/invoice ./internal/journal ./internal/authz ./internal/middleware`.
The full fmt command also reformatted an unrelated existing seed file; that
format-only change was restored, and all changed Go files were formatted.
After the last added regression, the affected-package race run passed again.
No real MongoDB, Firebase-authenticated workflow or production mutation was run.

Performance evidence is bounded to fixtures: linked-self resolution is reused
between invoice and payment (one employee-link lookup). A shared selected route
requires one snapshot, and two different routes require two scoped snapshots. Unchanged invoice assignment needs no fresh
route lookup. The Portal reuses its existing bounded employee/route queries and
caches for newly editable collector controls. No new dependency, polling or
per-row request was added. No production latency or query-plan gain is claimed.

## Coordinated rollout remains pending

API #388 now contains the independent INITIAL-PAYMENT policy. Deliver these
Portal changes with that API revision to non-production before acceptance.
Assignment grant names already exist in #388; apply its
approved additive tenant permission workflow and refresh permissions where needed.
No seed was applied here. Historical responsibility is not backfilled.

Run the API's updated `docs/reviews/responsibility-post-dev-validation.md` matrix:
separate parties, all grant combinations, canonical supervisor readback, reserved
redemption/assigned sync, edits and audit, replay/rollback, cross-company rejection,
route reconciliation and representative database plans. Reporting must attribute
merchandise to invoice supervisor and collections to journal collector without
adding either amount twice. These authenticated/database checks remain pending.

The user subsequently requested merging API #388 to dev. The corrected head was
committed, pushed, checked against current dev and merged after GitHub CI passed.
GitHub automatically marked #385 merged because its commit was included; no
separate merge of #385 was performed. The merged #388 remote branch and isolated
local temporary branch were deleted; the isolated checkout is detached at merged
dev. The user also authorized merging this companion Portal change to dev; the
Portal PR records its final source head, checks and merge state. Unrelated
journal-edit changes were excluded from this commit and preserved in the workspace. No live seed, index synchronization or historical repair was performed.
Deployment and authenticated responsibility acceptance remain unverified.
