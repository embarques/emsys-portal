# Current-company API audit — November 11, 2026

Historical snapshot. Latest recheck: [November 12, 2026](backend-gap-test-sweep-2026-11-12.md).

Target: `https://api.embarqueros.com/v1`, company `64d5c0b0d1eab2aaf30b1819`.
The user explicitly authorized disposable users, employees and other test fixtures.
Credentials were supplied through an echo-disabled stdin session and were not
written into this repository. No commits, pushes or deployments were performed.

## Live findings

| Contract | Observed result | Status |
| --- | --- | --- |
| Assigned pickup grants become effective on the same authenticated token | Addition enabled the owned update; removal denied it without changing the fixture | Verified |
| Assigned-only business-date access | HTTP 200 without financial grants; valid date, timezone, server time and next midnight | Verified |
| Default and explicit branch business-date lookup | HTTP 200 for omitted branch and original branches 1, 2 and 11 | Verified |
| Catalog barcode `route: null` and omission | Removal works, omission preserves; status/container preserved; past destination rejected | Verified for unfinished catalog fixtures |
| Mixed appointment batches | Empty/missing/zero/negative/other-branch batches leave eligible records unchanged; eligible removal resets route/order | Verified |
| New bank income starts pending | New ZELLE SALES journal has both statuses OUTSTANDING | Verified |
| Manual clearance atomically reconciles | Clearance succeeded with only `canClearJournal`; subsequent GET still had reconciliation OUTSTANDING | **Fails live** |
| Standalone bank reconciliation rejects | Administrator POST `/journals/reconcile` accepted an uncleared bank fixture with HTTP 200 | **Fails live** |
| Bank `autoClear` requires clearance grant only | Fixture actor held `canClearJournal`, lacked `canReconcileJournal`; POST returned 403: `canReconcileJournal is required to auto-reconcile` | **Fails live** |
| Posted journal DELETE | HTTP 409 | Verified |
| Reversal removes original from pending queues | Both statuses became NOT_REQUIRED; prior clearance/reconciliation evidence remained visible | Verified on originals |
| CASH ON HAND seeded | Original chart had nine accounts and no CASH ON HAND hierarchy; orphan ASSET 4 is not a substitute | **Still missing** |
| Published OpenAPI matches deployed route/settlement behavior | Business-date path absent; settlement descriptions still describe independent reconciliation | **Documentation/deployment mismatch** |

The bank result is from an independent second run: clearance was tested **before**
standalone reconciliation on a different journal. The first run's clearance result
was inconclusive because its fixture had already been reconciled.

Do not remove the portal's clearance-followed-by-reconciliation compatibility
handling on the basis of the backend summary alone. Deploy and verify the atomic
bank contract first. There is no Go API checkout in this workspace; these backend
behaviors were not patched or deployed here.

## Portal changes

- Invoice-embedded patches now preserve explicit `route: null` through both the
  label adapter and versioned invoice PUT. Omitted routes preserve the current
  assignment. Saved delivered status still blocks movement/removal; numeric
  delivery identity is not rewritten by the client.
- Route pickers use the non-financial business-date endpoint instead of the
  browser's calendar. Cache scope includes company, actor, role, effective grants,
  authentication and optional branch. Queries pause when closed/hidden, refresh
  on focus and server midnight, support cancellation, and fail closed on errors.
- Assignment writes read the clock once per batch and recheck its lifetime after
  asynchronous barcode reads. Branch context is forwarded where available.
  The API remains responsible for transaction-time validation and rollback.
- Numeric invoice batch submissions reject empty/over-200, duplicate, fractional,
  invalid and out-of-uint32 IDs instead of silently dropping or deduplicating IDs.
  Assignment mutations explicitly disable automatic retry because replay can
  allocate another trip number.
- Permission probes now retain the same Firebase token across role changes and
  test business-date access with assigned-only grants.
- Added [an opt-in bank fixture suite](../scripts/test-bank-clearance-fixtures-api.mjs). After the cleanup mistake below, it now
  grants adjustment privileges to the fixture actor, verifies that actor's branch
  before reversing, and **never falls back to administrator reversal**.

## Retained financial fixtures and cleanup correction

**Cleanup was not fully isolated.** The initial restricted finance actor lacked
adjustment grants. The test runner fell back to the administrator for reversal;
the API selected that administrator's NY branch/current closeout. This was a test
runner mistake, not evidence that branch reporting was unchanged.

Three $0.01 SALES entries were reversed, leaving balanced account postings across
the original/reversal pairs, but the three reversals reside in existing NY
closeout **32698**, branch **1**. Financial writes were stopped after discovery.
Their branch/closeout attribution still needs an authorized backend correction;
no deletion, reversal-of-reversal or compensating business transaction was attempted.

| Original SALES journal | Original branch / closeout / bank account | Reversal journal | Reversal branch / closeout |
| --- | --- | --- | --- |
| `6af51348c3c7aee9f998b252` | 12 / 32699 / 21 | `6af5134ac3c7aee9f998b255` | 1 / 32698 |
| `6af51378c3c7aee9f998b259` | 13 / 32700 / 22 | `6af5137cc3c7aee9f998b261` | 1 / 32698 |
| `6af5137ac3c7aee9f998b25c` | 13 / 32700 / 22 | `6af5137bc3c7aee9f998b25e` | 1 / 32698 |

Retained branches/accounts/closeouts are named with these markers:

- Branch 12/account 21/closeout 32699: `CODEX-BANK-c423863e-0a0b-4fac-9983-c98142126db7`.
- Branch 13/account 22/closeout 32700: `CODEX-BANK-cce034fb-4d06-4cb8-9867-b1279749ec37`.

They remain because posted financial history is immutable. The fixture closeouts
remain open; manual close is documented as disabled. Summary-total still shows
$0.01/$0.02 income in those original periods, while journal summary excludes the
reversed originals and reports zero. Do not treat this as completed branch cleanup.
All disposable Firebase identities, tenant users, employees, roles, route fixtures,
appointment fixtures, catalog barcode fixtures and auto-created customer fixtures
were deleted and absence checked by the applicable suites. Existing users' grants
and existing shipments were not changed.

## Validation

- Live scoped pickup suite: **46 passed, 0 failed**. Crew-revocation write control
  remains inconclusive because the update grant had already been removed.
- Live mixed appointment suite: **55 passed, 0 failed**.
- Live catalog lifecycle suite: **26 passed, 0 failed**.
- Independent live bank suite: **25 passed, 3 failed** (the three bank-contract
  failures above). Its original cleanup implementation was then corrected locally;
  the corrected financial script was not rerun against the live company.
- Final focused route/barcode regressions: **38 passed, 0 failed**.
- Broad unit run: **545 tests, 542 passed, 3 failed** (before the final
  additional adapter regression, which passed in the focused run). The same three failures
  reproduce against unchanged HEAD: two Add-transaction button-count assertions
  in `daily-income-start-display.test.mjs`, and one pending-financial-route grant
  assertion in `financial-activity.test.mjs`.
- TypeScript passed. ESLint: **0 errors, 97 warnings**. Production build passed
  after allowing Turbopack's local worker-port operation outside the sandbox.
- Request-count regressions verify no per-piece clock requests and unchanged
  route-list cache reuse. This change adds one small clock read per assignment
  batch, and a shared clock query for open pickers. No browser latency/profile
  improvement is claimed; authenticated browser E2E was not run.

## Remaining acceptance

Backend-reported fixes are not equivalent to tests executed here. Still unverified
in this run: the $100/$20/$80 discount accounting example; deferred invoice payment
applied exactly once on settlement; invoice bulk assignment's complete live
1–200/foreign-tenant/delivered matrix; CONDUCE plus invoice-only removal/delivery-ID
trip invariants on the live API; invoice deletion with documents; cross-tenant
isolation with a second disposable tenant; concurrent authorization/crew revocation,
delivery-versus-movement races and midnight rollback; deployed legacy confirmation;
and full production analytics reconciliation. Reproduce races with isolated API
integration fixtures, not existing shipments or business-period mutations.
