# Portal follow-up — separate from backend implementation

Standalone handoff. Restructured November 15, 2026; evidence remains dated
November 13–14, 2026. This edit adds no runtime verification or item closure.

Each ID uses **Issue → Expected result → Suggested action**, with actions split
into **API work**, **Database work**, and **Both — API and database together**.
API work covers commands, permissions, business rules and published contracts.
Database work covers persisted-state verification, indexes, seeds and migrations
where justified; verification does not automatically require a schema change.
Both covers atomicity, concurrency and acceptance across API and persisted state.
Portal work is explicitly assigned to portal owners rather than backend teams.

Scope: **F02, F03, F04; portal portions of V02, B16, B09, I08, B17–B19**. All requirements and acceptance steps needed for this packet
are included here; recipients do not need other portal files. Source observations
refer to API revision `4fdef23abcbaa89778d9ea6ca2d8f28b633cd270`.
Backend source paths are optional pointers in the recipient's own repository.
Endpoint paths are relative to `/v1`. Confirmed defects, unverified scenarios and
proposed designs are different states. Previously passing cases are regression
controls, not newly open defects. Use actual backend DTOs; proposed shapes below
are explicitly labeled and must be published before integration.

This packet assigns frontend integration and browser acceptance to **portal
owners**. API and database subsections identify dependencies only; they do not
ask backend teams to build portal state, forms or UI. The existing local fixes
are not commits, deployments or full end-to-end acceptance.

## F02 — Remaining live response and metadata parity

### Issue

**Local mapping complete; remaining endpoint-specific acceptance only.** The
reference audit passes 26 surfaces / 450 schema or compatibility fields. Branch,
container and vehicle adapters passed saved-fixture readback. Other response types
still need explicit parity checks; no generic missing-mapping task remains.
The portal reads `.reference/emsys-api/docs/swagger.json` (reviewed dev at 4fdef23);
`api-docs.json` was removed.

### Expected result

Portal adapters and metadata match actual API responses without layout changes.
Retain explicit hidden lifecycle/version/journal/inventory metadata and intentional
compatibility aliases, including invoice reservedAt, vehicle dates and User Activity
eventType/barcodeRouteChange. Re-audit after reference changes.

### Suggested action

#### API work

Dependency: B05 owners publish accurate Swagger/Scalar contracts and domain
owners verify actual response envelopes/fields. Source presence and served parity
are separate from live adapter acceptance.

#### Database work

No database work is established by the completed mapping audit. Investigate
persisted field gaps only when a concrete response-parity failure identifies one.

#### Both — API and database together

**Portal action:** re-run metadata audit after reference updates and perform
endpoint-specific live readback for remaining response types. Record exact mismatches,
not a generic reopening of all 26 surfaces. Keep intentional aliases/layouts.
Backend returns published and deployed evidence; portal verifies consumption.

## F03 — Real Firebase and persisted context isolation

### Issue

**Local transport/cache/provider implementation complete; browser acceptance
unfinished.** Mock regressions pass, but real Firebase login/refresh/logout,
actor/company switching and stored workspace/draft/filter isolation are uncertified.
Backend preflight still returned 403 for both localhost:3100 and 127.0.0.1:3100;
localhost:3000 returned 204 with Idempotency-Key missing from allowed headers.

### Expected result

Actor/company transitions clear previous queries/mutations and reset observers;
old persisted drafts/workspaces/filters cannot appear in the next context.
Ordinary token renewal retains the current context/cache. Real browser commands
retain Firebase JWT and x-company-id and rely on API permission authority.

### Suggested action

#### API work

Dependency: backend explicitly permits approved port-3100 origins and required
Authorization/x-company-id/If-Match/Idempotency-Key headers. Verify actual browser
commands after preflight; preserve exact origin and permission scope.

#### Database work

No backend data migration is established by portal cache isolation. Browser
workspace/draft/filter persistence is portal-owned client state, not an API cache
or database authorization source.

#### Both — API and database together

**Portal actions:**

1. Use real authorized Firebase test credentials/companies for login, token
   refresh, logout and actor/company switching after platform configuration ships.
2. Exercise pending responses, mutations and persisted workspace/draft/filter
   restoration across transitions. Prove no old-context data becomes visible.
3. Keep ordinary token renewal stable and distinguish mock controls from real
   browser evidence; no new token/cache rewrite is implied by unfinished acceptance.

## F04 — Loan increase activation and recovery acceptance

### Issue

**Implemented locally and gated; remaining variants only.** Scoped frozen UUID/
payload, concurrent submission deduplication and uncertain-response retention pass
local controls. NY branch 1/account 7 passed issue, increase, concurrent exact retry,
changed-payload conflict, full repayment and exact after-PAID replay via real portal
adapters. After-period-closure, other-actor and fault/atomicity cases plus activation
remain open. Browser-unmount/reload recovery is not certified.

### Expected result

Activate only after remaining deployed acceptance. Authorized exact retry returns
the original transaction/journal with current loan after later loan changes/period
closure and no duplicate effects; changed UUID payload conflicts. New commands use
current eligibility. Existing successful NY cases are regression controls.

### Suggested action

#### API work

Dependency: loan owner verifies named grants, branch/employee/account eligibility,
requestId UUID binding and remaining B12 lifecycle cases. New account setup requires
eligible LOAN parent, layer 3 and available explicit code 1300–1399; missing template
setup does not invalidate existing NY account 7 lifecycle results.

#### Database work

Dependency: prove atomic principal/transaction/journal changes and durable replay
identity under fault and concurrency. Portal reload recovery is distinct from
backend command idempotency and requires its own agreed behavior.

#### Both — API and database together

**Portal actions:** complete after-period-closure, other-actor and failure/retry
integration with backend, then activate the gated action when criteria pass.
Verify unmount/reload recovery explicitly before claiming it. Preserve existing
scoped UUID/payload and concurrent-submit behavior; do not redo passing adapters.

## V02 — Reconciliation and clearance portal alignment

### Issue

**Confirmed policy awaiting implementation/integration alignment.** The current
portal reconciliation queue blocks awaiting-clearance bank receipts. That conflicts
with the confirmed internal-receipt policy; recording the decision did not change
product code. The reviewed backend also rejects those bank reconciliation cases.

### Expected result

Reconciliation confirms responsible-party internal receipt and never clears a
payment. Clearance confirms posting and atomically reconciles as well. Permit
eligible uncleared bank receipts in the reconciliation queue after backend
alignment; remove the current awaiting-clearance block. Preserve separate grants,
clear-on-save consent and exactly-once invoice application only on clearance.
If already reconciled, keep the original confirmation actor/time. Existing
transactions may progress after their entry-day closeout closes; registered-day
attribution stays fixed while labeled reconciled/cleared breakdowns may update.

### Suggested action

#### API work

Dependency: permit eligible uncleared bank reconciliation without clearing or
applying deferred invoice receipts. Clearance atomically reconciles and applies
eligible deferred receipts once under its own clearance grant; separate standalone
reconcile permission is not additionally required for the combined clear action.

#### Database work

Dependency: preserve original registration date/closeout, first reconciliation
actor/time and distinct clearance actor/time. Clearing an already reconciled receipt
must not duplicate invoice application or income.

#### Both — API and database together

**Portal actions:** remove the awaiting-clearance block for eligible bank
reconciliation after backend alignment. Retain separate action grants and clear-on-save
consent. Verify reconcile-only, clear-only, already-reconciled clearance and progression
after the original entry-day closeout closes. Keep registered-day totals fixed and
label reconciled/cleared breakdowns explicitly; no reopening or date movement.

## B16 — Authoritative generation defaults and configuration

### Issue

**Remaining portal generation work plus separate backend status defect.** Branch
form/read defaults no longer invent status 1, but create/update/generate paths still
use NEW_BARCODE_STATUS fallbacks. Configured NY default creation passed; embedded
CONDUCE update still failed persisted readback. Administrator configuration/default
selection and fallback removal remain open.

### Expected result

Use explicit catalog-valid branch default; no inferred ID 1/first-step fallback.
Only administrators change branch defaults; dedicated workflow grant manages extra
pre-CONDUCE steps. Common CONDUCE/ENTREGADO remain 6/7 and DEV-RD=5. Preserve drafts
and block unconfigured generation with a clear configuration path.

### Suggested action

#### API work

Dependencies: backend validates branch default and administrator-only changes,
exposes authoritative catalog/configuration and fixes embedded CONDUCE persistence.
Do not treat already-passing default creation as a new defect.

#### Database work

Dependencies: verify persisted applicable branch configuration and catalog IDs.
Any status/identity migration belongs to the backend domain, not frontend fallback
replacement; preserve permanently reserved printed numbers and history.

#### Both — API and database together

**Portal actions:** remove all remaining NEW_BARCODE_STATUS create/update/generate
fallbacks through shared authoritative branch/catalog resolution. Preserve drafts on
errors. Direct administrators to Branches → edit → Settings → Default label status;
direct other users to an administrator. Keep unconfigured generation blocked and
verify permission/catalog/context changes against real responses.

## B09 — Selected search integration

### Issue

**Remaining query rollout.** Branches, Vehicles, Containers and Supply items main
search alignment is local. The broader selected per-surface contract still needs
operator/sort/deployment acceptance; nine chosen backend capabilities remain rejected.
Passing ordinary branch/container/vehicle reads are not pending defects.

### Expected result

Main-search OR combines with advanced-filter AND under server scope/pagination.
Only deployed supported operators/sorts are offered; typed values, deterministic
ties, cancellation and permissions remain correct. No fleet download or per-row
lookup substitutes for an unsupported backend field.

### Suggested action

#### API work

Dependency: seven filters/two sorts across five POST operations:
branches/search settings.labelPrefix; containers/search barcodeSequence and
deliverySequence; inventory/receipts/search and inventory/dispatches/search postedAt
filter/sort each; vehicles/search inspectionDate and registrationDate filters.
Publish actual operators/errors/date/null/tie behavior. Other 44 rejected historical
candidates remain outside the selected contract, not implicitly re-approved.

#### Database work

Dependency: backend verifies persisted posting timestamps, typed numeric/calendar
values and representative query plans/index use. Portal work introduces no schema
or historical data migration.

#### Both — API and database together

**Portal actions:** retain disabled controls for all nine unsupported additions.
After deployment, align each selected surface and verify main/advanced composition,
operators, sort ties, pages, permissions and company/branch transitions. Use canonical
supplier companyName and ID-based supplier/holder filters. Receipt/dispatch notes is
in source allow-lists; verify deployment before changing status-only main search.

## I08 — Vehicle alert rendering and full-coverage integration

### Issue

**Partial local fix; incomplete integration.** Seven-day warning changed to ten
with boundary tests, but the hook still uses a bounded 200-vehicle snapshot and
operator-local day. Red Vehicles sidebar badge, authoritative counts/calendar and
agreed inbox lifecycle remain unfinished.

### Expected result

Inspection/registration alerts begin ten calendar days before due, include due
today/overdue and are visible to vehicle:view users within authorized company/branch
scope. Sidebar red badge, table and inbox share full-directory server eligibility.

### Suggested action

#### API work

Dependency: publish actual full-directory alert/count/inbox DTOs and business
calendar; confirm vehicle-versus-event counts, read/dismiss/dedup policy. Low-pool
notification trigger/audience/recovery is separate; zero threshold is valid and
ten days is not a reserved-number threshold.

#### Database work

Dependency: backend verifies complete evaluation, scoped durable notifications
where applicable, permission revocation and date corrections. Portal must not scan
only a bounded snapshot or invent notification storage.

#### Both — API and database together

**Portal actions:** wire red Vehicles sidebar badge, table indicators and inbox
to the published server contract, replacing local bounded evaluation. Verify 11/10-day
boundary, due today/overdue, midnight/DST, missing/corrected dates, more than 200
vehicles, revoked read grants and company/branch switches across all three surfaces.

## B17 — Complaint type-first intake rollout

### Issue

**Backend model proposal and subsequent portal integration.** Reviewed source
still has eight generic categories and live category GET returned 404. Current
reference-based complaint screens do not establish deployed model acceptance.
The portal retains its current model until the replacement API ships.

### Expected result

Offer General, Appointment or Delivery first. Appointment chooses a sender then
one of that sender's appointments; Delivery chooses an invoice then optional
barcodes from that invoice. Every type permits zero or more employees except
employee_behavior, which requires one. Use localized topics, caller, subject,
description and severity. New intake does not offer ambiguous order targets.

Keep retained legacy categories, details and targets readable and workable.

### Suggested action

#### API work

Dependency: backend publishes the three-type/topic/link model and resolves
category route deployment. Server derives sender from appointment/invoice, rejects
barcode/invoice mismatch and foreign links, and enforces matching intake/edit
validation. Existing customer and invoice search support lookups.

#### Database work

Dependency: explicitly migrate shadowing category overrides while retaining
historical category/details/targets and insight totals. Portal does not migrate
or reset retained complaints itself.

#### Both — API and database together

**Portal actions after deployment:** build type-first intake. Appointment uses
sender search then POST /pickups/search by sender.id, newest first. Delivery searches
invoice number/sender name/phone then offers barcodes from that invoice. Add employee
multi-select and localized topics; filter tables by type/topic/customer/invoice/
employee. Verify zero-employee and employee_behavior validation, legacy readback
and tenant-scoped lookups against actual published contracts.

## B18 — Complaint media upload and gallery integration

### Issue

**Proposed backend upload capability and unfinished portal rollout.** Existing
link-only staff attachments do not establish customer image/video uploads or private
storage acceptance. Upload/link/removal contracts and suggested file limits must be
settled and published before portal wiring.

### Expected result

Staff can upload customer photo/video evidence with progress and safe retry.
Private image previews and video playback use short-lived authorized signed links.
Reasoned removal hides media while retaining case history; old staff attachments
remain readable.

### Suggested action

#### API work

Dependency: publish multipart upload, optional uploadId identity, signed-link
and reasoned-removal DTOs, permissions and If-Match behavior. Confirm suggested
25 MiB image / 200 MiB video / 30-file limits with the modeler; they are not verified
production limits.

#### Database work

Dependency: backend owns company-private document storage, media metadata and
retry/failure recovery, retaining uploader snapshots and removal events. Portal
must not persist public URLs or invent a media collection.

#### Both — API and database together

**Portal actions after deployment:** integrate customer upload progress/retry,
private image/video gallery and authorized signed-link refresh/removal. Verify
same-upload retry identity, stale version, type/size errors, foreign-media denial,
expired links, removal history and legacy attachment readback without losing drafts.

## B19 — Complaint case timeline and editable solution

### Issue

**Proposed backend extension and unfinished portal integration.** Current
status/assignment/note events and resolution-on-transition do not establish the full
case history or solution drafting/correction workflow.

### Expected result

Show ordered actor/time history for creation, status, assignment, note/reopen,
severity, links, employees, media and solution changes. Solution can be drafted while
open/in progress/waiting or corrected while resolved; closed cases must reopen first.
Resolving requires a non-empty solution; resolution transition actor/time stay intact.

### Suggested action

#### API work

Dependency: publish B19 event read models and solution-only PATCH with If-Match,
stale-version errors and closed-state rules. Keep resolvedBy/resolvedAt tied to the
resolved transition; every committed solution change records its own event.

#### Database work

Dependency: backend persists case/event changes atomically with actor snapshots
and before/after values. Stale or failed edits must leave no partial case or history
effects; retained legacy events remain usable.

#### Both — API and database together

**Portal actions after deployment:** build actor/time timeline and solution panel
with draft, correction and closed-state behavior. Verify version conflicts preserve
input, all listed event types render correctly, and no repeated success event appears
on supported exact retry. Coordinate B18 media events and verify actual readback.

## Other reference-based surfaces and verified controls

Change Requests search/filters (`POST /change-requests/search`), complaint target
replacement/staff attachments/insights/notification inbox, and User Activity
eventType/barcodeRouteChange columns/filters need actual deployment/integration.
Existing unfiltered lists remain usable; reference declaration is not runtime proof.

Approved NY rollover opened period 32738. Existing loan and invoice adapters passed
basic loan lifecycle, unpaid PENDING→COMPLETED registration/exact replay, configured
default creation and employee/non-DR pickup-route receivedBy controls. Seventeen
reservation claim/date and five tie/cursor/restoration controls passed; keep only
broader boundary/context variants open. Do not reopen these positives as generic
portal implementation gaps. Legacy closeouts require separately reviewed one-time
migration; normal rollover is not a historical repair.

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
