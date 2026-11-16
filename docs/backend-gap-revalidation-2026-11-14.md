# Pending-gap revalidation — November 14, 2026

This pass used automated portal tests, bounded live API probes and the read-only
API reference at `4fdef23abcbaa89778d9ea6ca2d8f28b633cd270`. The supplied token
was accepted for company `64d5c0b0d1eab2aaf30b1819`. Credentials are excluded from
reports. Only newly created tagged fixtures were directly mutated/deleted;
pre-existing records were not deleted. No backend source was changed.

## Later existing-branch follow-up

[The NY/DR follow-up](backend-gap-active-branches-2026-11-14.md) supersedes the
initial isolated-branch setup blockers and verified subcases below. The user
approved normal NY rollover, creating 32738/closing 32736. The NY loan lifecycle,
concurrent exact replay, full repayment, after-PAID replay, configured piece
defaults, unpaid completion, both receivedBy positives and selected non-null
reservation/cursor controls now pass. Embedded CONDUCE readback still fails.
The initial results below remain an audit record, not extra pending tasks.

## What was fixed or removed from active work

- Vehicle inspection/registration warning lead time was incorrectly seven days.
  It now uses the confirmed **10 calendar days**, with tests for both kinds at
  10 days, 11 days, due today and overdue. Full alert integration remains I08.
- F02's missing local schema/table mapping is complete: the API-reference audit
  passes **26 surfaces / 450 fields**. Branch/container/vehicle read adapters also
  successfully normalize this run's saved fixtures. Other concrete live response
  parity checks remain distinct from local metadata mapping.
- F04's missing requestId/retry adapter implementation is already fixed locally:
  scoped UUID/frozen payload, in-flight deduplication and uncertain-response
  retention pass unit controls. Only activation/deployed loan acceptance and
  uncertified reload recovery remain. Do not keep the old “adapter omits requestId” task.
- F03's local query/provider isolation is implemented and tested. Real Firebase/
  browser and stored workspace/draft/filter acceptance remains, as does backend CORS.
- Selected financial subcases passed again: cash/default/source behavior, exact
  receipt application and replay, changed UUID payload conflict, same/different-key
  clearance races, mixed/missing batches, bank canonicalization, selected invalid
  funding rejection and rejected-update preservation. These are regression controls,
  not unresolved blanket defects. The financial run passed **102 assertions** and
  reproduced **one failure (B15)**.
- Bounded journal descending ordering and selected loan unsupported-field/error,
  protected-change search, reservation null/date-validation controls passed
  **23 assertions**. Source/endpoint presence or accepted empty searches alone
  does not prove isolation, meaningful matches, concurrency or database history.
- The other 44 of the original 53 rejected search candidates remain outside the
  selected product contract. Only the selected nine are active B09 implementation work.

## Current unresolved backend scope

No whole backend ID is closed by a partial positive control. Each row below is
what remains, rather than a claim that every scenario is a reproduced defect.
The domain handoffs carry these same residuals and the necessary standalone rules.

| ID | Classification | Only work still pending |
| --- | --- | --- |
| B05 | Confirmed publication/source-schema gaps | Public Swagger/Scalar 297 paths/350 schemas versus source 311/371; 11 selected declarations missing/incomplete publicly. Two source corrections: single embedded route nullability and bulk positive uint32 item bounds. Publish actual contracts; runtime acceptance separate. |
| B09 | Confirmed unsupported live/source capabilities | Seven filters/two sorts: branch settings.labelPrefix; container barcodeSequence/deliverySequence; vehicle inspectionDate/registrationDate; receipt/dispatch postedAt filter and sort each. All remain unsupported, including with saved mock controls. |
| B12 | Setup and lifecycle unverified / not activated | Live bounded catalog has no eligible layer-3 1300–1399 parent; isolated branch has no eligible LOAN account. Establish safe setup, then issue/increase/payment, replay after closure/state changes, concurrency/rollback and publication. |
| B15 | Reproduced persisted financial defect | EXPENSE accepts persisted ASSET account with client-forged name/type. Fix authoritative account resolution and compatibility before writes across posting paths. |
| B16 | Shared implementation/integration gap | Explicit valid admin-configured branch defaults, generation blocking, removal of portal fallbacks, supported status persistence/transitions and workflow-catalog permissions. Source default lookup alone does not prove the target. |
| B17 | Requested model/deployment change | Three EMSYS complaint types/topics and linked appointment/invoice/barcode validation, tenant override migration and portal rollout. Local source remains generic; live complaint category route returned 404. |
| B18 | Requested media integration | Private customer image/video upload, idempotent retry, signed reads, reasoned soft removal and retained history; proposed limits require design confirmation. Not certified by generic staff URL attachments. |
| B19 | Requested history/solution integration | Atomic case events with actor snapshots for every change, and versioned solution drafting/correction before closing. Generic status events do not establish this target. |
| V02 | Unverified controlled settlement cases | Injected failure between settlement/dependent writes, closed-period lifecycle and rollback. Basic selected settlement/race/replay controls passed. |
| V05 | Remaining account matrix / B15 dependency | Inactive/non-posting/foreign-company accounts, protected BANK changes, allocation and remaining corrections/methods. Selected missing/wrong-branch create/sync/update controls passed. |
| V06 | Unresolved eligibility and incomplete target integration | Valid numeric bulk control, permanent printed-number identity/migration, shared trip and then missing/foreign/delivered/replay atomicity. November 16 backend clarification: retain the increasing sequence; deletion leaves the counter unchanged and numbers retired. Reservation-table proposal withdrawn; import/reseed counter preservation and atomic concurrent allocation remain unverified. Earlier empty/duplicate/oversized guards passed. |
| V07 | Unverified actual-state lifecycle | CONDUCE/delivered and nonempty membership, return/reassign, legacy pieces and completion races. Earlier versioned null removal/mirror synchronization passed. |
| V08 | Unverified linked history | Allowed/denied invoice deletion with financial/audit retention and direct history proof. Earlier ordinary deletion/document/version guards passed. |
| V09 | Unavailable legacy duplicate fixture | Address-only changes to directly seeded duplicate identities with linked history; ordinary validated create/edit controls already pass. |
| V10 | Unverified invoice-specific variants | Unpaid completion, assignment/customer negatives, revocation/replay, initial-payment completion effects, branch 11 and receivedBy variants. Selected cash registration/payment effects are narrower proof. |
| V11 | Unverified delivery enforcement/integration | Concurrent balance/uncleared receipt checks, policy/signature/photo ownership, actual scoped actors/pieces and shared-trip completion/replay. |
| V12 | Unverified failure and broader inventory paths | Injected stock/financial rollback, remaining valuation/dispositions, grants/autoReconcile and historical custody. Prior basic two-cost close/reopen/replay controls pass. |
| V13 | Unavailable closeout-clock controls | STALE_OPEN_CLOSEOUT/LATEST_CLOSED, midnight/DST, cross-period mutation/rollback. Manual closure intentionally returns 409. |
| V14 | Unverified non-null/context/concurrency cases | Tenant/branch/filter/sort-bound cursors, page-spanning concurrent ties and non-null claim timestamps across business midnight/DST. Null/invalid-date controls passed again. |
| V15 | Remaining real resource/actor matrix | Invoice/journal/barcode/inventory approvals, pickup VOID, remaining grants and company/branch isolation. Earlier scoped pickup UPDATE/self-approval/revocation controls are established. |
| I01 | Backend-controlled tests unavailable | Mid-write assignment/patch/completion rollback and movement/midnight races. Source fixtures exist; Go/Mongo not available here. |
| I02 | Backend-controlled tests unavailable | In-flight role/grant and crew revocation at commit plus guarded throughput/latency. Ordinary post-revocation rejection does not close it. |
| I03 | Direct persisted history/migration unverified | Commit-before-history and no history on abort, history indexes, retained queues/badges and activity parity across writers. Fixture reversals alone do not prove ordering. |
| I04 | Setup/allocation/migration unverified | Eligible master loan template absent live; safe seed/retained-data plan, real-DB ancestry/cycles, occupied/exhausted/concurrent codes and historical mappings. |
| I05 | Representative historical data unavailable | Retained manifest/analytics/snapshot attribution and timezone reconciliation. Source fixtures cannot establish production parity. |
| I06 | Legacy test service not exercised | Actual confirmation failure/success/uncertain recovery/replay and no repeat remote confirmation after commit. |
| I07 | Plan/load access unavailable | Representative indexes/plans, examined keys/docs, request/payload/latency budgets, contention and cancellation. No performance improvement claimed. |
| I08 | Partial portal fix; end-to-end integration incomplete | Ten-day lead time fixed. Full server-scoped coverage/calendar/counts, red Vehicles badge, inbox lifecycle, access revocation, >200 vehicles and low-pool delivery remain. Current vehicle snapshot/local-day implementation is incomplete. |

## Fixture ledger and independent readback

- Directory run 1 marker: `CODEX-REVALIDATE-de9424bc-b8cb-40b5-83a3-036562cc959a`.
  Retained new branch **50**, container **1415**. Vehicle creation rejected because
  the harness initially omitted required branch code; that was a harness error,
  corrected without treating it as a backend gap.
- Directory run 2 marker: `CODEX-REVALIDATE-48021574-f49f-4324-b7c0-82126694ffbb`.
  Retained new branch **52**, container **1416**, vehicle
  **6af8922d31a295cf38084330**. Read adapters passed; the selected filters still reject.
- Financial marker: `CODEX-BANK-9c96a9b4-d763-4c2d-a989-77fc51a2ac6a`.
  Audit-linked branch **51**, closeout **32737**, accounts **60/61** and financial
  history are retained. The suite reversed its remaining 11 journals and removed
  only its new employee **271**, API user **160**, role **88** and temporary Firebase
  identity. No existing closeout was used/closed to force a test.
- Independent readback passed **16/16** checks: the 11 tracked journals remain in
  fixture branch 51/closeout 32737 and outside both pending queues; all five retained
  directory records carry the correct run marker. A complete 36-account readback
  still finds zero eligible layer-3 loan parents.

## Harness corrections and evidence limits

The first vehicle fixture request missed required branch code; the corrected
fixture succeeded. In run 2, invalid-date assertions initially treated any 400 as
validation proof. Review invalidated those two assertions: valid date filters
also returned unsupported-field 400, so date validation remains unverified. Raw
requests/results and explicit review corrections are retained. The updated runner
requires a successful valid matching control before certifying invalid-date rejection.
It also uses the documented lte operator for the date-boundary negative control.

The reference's Go/Mongo tests were inventoried, not run. This environment has no
Go or mongod executable. No unsafe seed reset, historical-period manipulation,
production failure injection or existing-role/grant edits were used. Public
specification checks do not assert missing runtime routes. Capacity, direct
history, in-flight authorization and retained-data/legacy-service acceptance remain
open precisely because these methods did not establish them here.

## Reproduction and evidence artifacts

Local validation passed: the existing 610-test unit suite before the warning
change, all four vehicle-compliance tests after it, the 26-surface/450-field
metadata audit, final TypeScript check, focused ESLint, script syntax, translation
JSON/key checks, document/ID/link checks and `git diff --check`. The production
build passed outside the sandbox; its initial sandbox attempt failed because
Turbopack could not bind its internal worker port. No authenticated browser
session or Go/Mongo integration suite was executed. The warning's English and
Spanish descriptions now also say ten calendar days. Temporary credential files
were removed after live checks.

Supply a fresh token through `EMSYS_TOKEN` in the process environment; never
commit it or include it in a report. Commands use the supplied company context.

```bash
node scripts/revalidate-pending-gaps-api.mjs --bearer --company <company-id> --write-fixtures --output /tmp/gap-controls.json
node scripts/test-backend-gap-contract-controls-api.mjs --bearer --company <company-id> --output /tmp/contract-controls.json
node scripts/test-bank-clearance-fixtures-api.mjs --bearer --company <company-id> --write-fixtures --matrix --loan-lifecycle --output /tmp/financial-controls.json
node scripts/audit-api-table-columns.mjs
npm run test:unit
```

Fixture writes require an explicitly approved company. Read/review each runner's
current ownership/cleanup rules before execution. Rerunning creates new uniquely
tagged fixtures; the revalidation runner retains its directory mocks. Financial
fixtures retain immutable audit history and clean up only their own identities.

- `backend-gap-revalidation-2026-11-14.json`: initial live query/CORS/route probes,
  saved branch/container controls and the incomplete first vehicle setup.
- `backend-gap-revalidation-controls-2026-11-14.json`: corrected fixture run,
  adapter controls and explicit review corrections for the invalid-date assertions.
- `backend-gap-financial-revalidation-2026-11-14.json`: 102 passing assertions,
  B15 failure, new-branch financial readbacks and cleanup results.
- `backend-gap-contract-controls-2026-11-14.json`: 23 passing bounded controls.
- `backend-gap-fixture-readback-2026-11-14.json`: independent 16/16 fixture checks
  and complete account-parent prerequisite readback.
- `backend-gap-publication-audit-2026-11-14.json`: fresh served versus source
  declaration comparison; not runtime acceptance.
- `backend-gap-source-checks-2026-11-14.json`: 24-file source/test/fixture inventory
  with hashes and environment prerequisites; not test execution.
