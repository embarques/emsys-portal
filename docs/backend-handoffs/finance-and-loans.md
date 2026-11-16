# Finance, accounts, settlement and loans

Standalone backend handoff. Updated November 14, 2026.

Each ID below uses **Issue → Expected result → Suggested action**. Confirmed
failures, unverified scenarios and unresolved design decisions are labeled
explicitly. Suggested actions are split into **API work**, **Database work** and
**Both — API and database together**. No other portal files are required to
understand this assignment.

- **API work:** request/permission validation, business rules, commands, errors and
  published contracts.
- **Database work:** persisted-state inspection, indexes/constraints, seeds or
  migrations where justified. A database verification task is not automatically
  a request for a schema change or historical data repair.
- **Both:** behavior that must be implemented or verified end to end across the
  API and persisted state, especially atomicity, concurrency and safe migration.

These are work boundaries, not named-team assignments. Portal dependencies stay
explicitly identified as frontend responsibilities.

Scope: **B15, B12, V02, V05, V13, I04**. Endpoint paths are relative to `/v1`.
Source observations refer to API revision
`4fdef23abcbaa89778d9ea6ca2d8f28b633cd270`. Live results were captured November
13–14, 2026; this restructuring adds no new runtime verification or closure.
The API reference remains read-only. Backend source paths below are optional
starting points in the recipient's own repository.

## B15 — EXPENSE classification trusts client metadata

### Issue

**Confirmed live defect.** `POST /journals` accepted
`account: {id: 5, name: "Gasolina", type: "EXPENSE"}` even though persisted
account 5 is LOAN RECEIVABLE / ASSET. Saved ledger readback debited that account
under the forged classification. A real branch-local EXPENSE account succeeded
as a positive control. The November 14 isolated financial run reproduced this.
Gasolina is a legitimate expense; the probe deliberately supplied the wrong
account ID. The defect is accepting that ID/name/type mismatch, not treating
fuel as an expense.

This establishes the ordinary create defect. It does not establish that every
sync/update/correction path has the same defect; those paths need review.

### Expected result

The persisted tenant account determines classification, type and posting
eligibility. An ASSET account cannot become an EXPENSE category because the
client supplies a different name/type. Classification and funding/source accounts
are different references and must each satisfy their own contract.

Valid persisted IDs may have stale display metadata; canonicalizing that metadata
is consistent with the already verified bank-reference behavior. Do not reject a
valid account solely for an outdated label unless the contract requires it.
Rejected requests leave journals, balances, source versions and retry state
unchanged. A frontend dropdown restriction is not backend enforcement.

### Suggested action

#### API work

1. Resolve classification references from tenant storage before posting; validate
   persisted type, posting eligibility and documented account/branch scope.
2. Review create, sync, update and correction for the same trust boundary. Only
   ordinary create is a confirmed failing path; verify the others before changing them.
3. Save canonical metadata for valid IDs. Do not reject valid global/system
   accounts or stale display labels without a contract reason.

#### Database work

1. Inspect persisted account references and journal/ledger snapshots to verify
   the mismatch and unchanged state after rejection. This is database verification,
   not evidence that a schema change or new table is required.
2. Do not bulk-reclassify historical entries from a supplied name such as Gasolina.
   Any real historical repair needs separately identified affected records,
   confirmed intended accounts and an audited correction/migration plan. The
   reproduced mock postings were already reversed.

#### Both — API and database together

1. Run the genuine EXPENSE positive control and ASSET-ID negative control through
   the API, then inspect saved state. Extend regressions to affected write paths.
2. Prove failed validation/partial writes leave journals, balances, source versions,
   history and retry state consistent. Fix B15 before certifying V05.

## B12 — Remaining loan-increase guarantees and rollout

### Issue

**Partially verified; not a missing endpoint or broken basic lifecycle.** In
existing NY branch 1, account 7 and cash account 1 supported a new mock loan:
$1 issue, $0.25 increase, concurrent identical UUID retries, changed-payload
conflict, full $1.25 repayment, and exact retry after PAID. Readback retained
one issue, one increase and one payment, linked to NY closeout 32738.

Still unverified: exact retry after the original period closes, remaining actor/
eligibility/error cases, independent logical-command concurrency and injected
failure between principal/transaction/journal writes. Publication is incomplete;
portal action activation and browser-reload recovery are separate integration work.

### Expected result

`POST /loans/{id}/increases` accepts a nonzero UUID `requestId`, `employee`,
`sourceAccount`, positive finite cent-precision `amount`, and optional
`transactionDate`, `referenceNumber`, `description`. The reviewed source requires
journal-create permission, an active actor in the loan branch, the matching
employee and an eligible posting ASSET/BANK source.

**Previously confirmed design:** an authorized exact retry returns the original
transaction/journal with the current loan, including after period closure or
later loan-state changes, without new effects. Changed-payload UUID reuse
conflicts. A new increase must satisfy current eligibility. Tenant, loan, actor,
UUID and payload binding must be preserved.

Principal, transaction and journal commit together. Both issue and increase have
wire transaction type **LOAN**; do not require an invented INCREASE enum. Raw
zero balance may be omitted; the portal derives zero from principal minus paid.

### Suggested action

#### API work

1. Verify remaining actor/branch/employee/source eligibility and error cases;
   preserve current access checks on exact retries and distinguish a retry from
   a new increase. Keep the verified NY lifecycle as a regression.
2. Publish requestId, grants, payload binding, errors and original-result/current-
   loan replay semantics. Do not invent a wire transaction type INCREASE or
   require an explicit raw balance:0 where the current schema omits zero.

#### Database work

1. Verify the existing persisted UUID/actor/loan/payload binding and uniqueness
   mechanisms. Inspect actual indexes/records before proposing schema/index changes;
   a new command table or migration is not automatically required.
2. Verify principal, transaction, journal and retry identity are committed together
   and retained for replay. New-account template setup belongs to I04; existing
   NY account 7 already supports the basic lifecycle.

#### Both — API and database together

1. Close the original period in an isolated backend fixture and retry its exact
   committed increase. Confirm original result IDs, current loan and no new effects;
   do not close today's shared period just to manufacture this case.
2. Exercise independent logical-command races and injected failures between
   dependent writes; prove rollback and no duplicate principal or journal effects.
3. Return deployed evidence for remaining acceptance and coordinate portal F04
   activation separately. Browser-reload recovery is not certified by DB replay
   or a mounted-session portal test.

## V02 — Internal reconciliation, clearance and closed-day acceptance

### Issue

**Required behavior alignment plus unverified failure cases.** The modeler
confirmed on November 14, 2026 that reconciliation confirms internal receipt by
the responsible party; clearance confirms actual payment posting. Reconciliation
does not clear, but clearance must reconcile.

The reviewed API `internal/journal/reconciliation.go` rejects bank transactions
through `requiresBankClearance(entry)`. The portal's journal queue also blocks
reconciliation while clearance is outstanding. These reflect the superseded
bank-must-wait rule and need alignment; earlier tests expecting rejection no
longer certify intended behavior. No new live probe ran for this decision.

Selected clearance races, replay, exactly-once invoice application and mixed/
missing batch controls passed previously. Injected dependent-write failures and
post-closeout lifecycle scenarios remain unverified.

### Expected result

**Confirmed state rules:**

| Action | Reconciliation | Clearance | Deferred bank invoice payment |
| --- | --- | --- | --- |
| Internal receipt confirmation | Reconciled | Unchanged; may remain outstanding | Not applied |
| Actual payment clearance | Reconciled, atomically with clearance | Cleared | Applied exactly once |

An authorized user can reconcile an uncleared bank receipt. Reconciliation uses
its own grant and does not grant clearance rights. Authorized clearance includes
reconciliation without a separate standalone reconciliation request/grant. If
already reconciled, retain the original receipt-confirmation actor/time and
record clearance actor/time separately. Failed commands leave all dependent
states consistent and retries do not duplicate effects.

**Closeout purpose:** the closeout is a daily entry window and operational income/
expense summary. Closing it prevents new entries into that day; existing records
may still be reconciled or cleared. Keep the original journal date/period and
registered amounts attributed to the entry day. Reconciled/cleared breakdowns
can update as statuses progress and must be labeled accordingly. Do not impose
an immutable accounting-period snapshot or create duplicate income for clearance.
Show actual clearance timing separately. Financial corrections still require
their documented permissions and audit trail.

Cash receipts continue to apply immediately; bank invoice receipts apply through
clearance, never internal reconciliation. `POST /journals/clear` retains its
`{requestId, ids}` command and `canClearJournal` grant.

### Suggested action

#### API work

1. Remove the unconditional bank exclusion from eligible standalone reconciliation.
   Preserve responsible-party scope, grants and lifecycle/version protections;
   reconciliation must not clear or apply deferred invoice payments.
2. Preserve clearance as the authorized combined action: mark cleared and
   reconciled and apply eligible deferred receipts once, without a second standalone
   reconciliation call/grant. Publish these transitions and closed-entry-day behavior.
3. Keep original journal date/period attribution and distinguish registered-day,
   reconciled and cleared breakdowns. Do not count clearance as new income.

#### Database work

1. Verify storage permits reconciled-but-uncleared records and keeps separate
   reconciliation and clearance actor/time attribution. Existing separate fields
   may already suffice; no schema migration is assumed.
2. Preserve original internal-confirmation actor/time when subsequently clearing.
   Inspect journal/receipt mirrors, invoice applied-payment state, audit records
   and persisted command identity for consistency.
3. Check report/summary storage or caches for obsolete coupling/frozen-status
   assumptions. Update derived status breakdowns as needed without moving original
   entries or duplicating registered amounts. Any retained-data backfill needs
   an explicit, reviewed plan rather than an incidental rewrite.

#### Both — API and database together

1. Test reconcile-before-clear: only reconciliation changes; then clear: both
   statuses complete, payment applies once and original confirmation survives.
   Also test direct clearance, denied grants, exact retries and concurrent commands.
2. Extend `journal/financial_controls_integration_test.go`,
   `TestFinancialControlsIntegration`, with failures between settlement, invoice
   application/mirrors, command receipt and audit writes. Prove rollback and
   one application after retry; correction failure alone is insufficient.
3. Run these actions after the source entry day closes. Verify original attribution,
   updating status breakdowns, actual clearance timing and no reopened day or
   duplicate income. Already passed clearance race cases remain regressions.
4. **Portal dependency, separate owner:** remove the awaiting-clearance queue
   block after backend alignment. Preserve separate action grants and clear-on-save
   consent; do not repurpose an ambiguous create flag for internal confirmation.

## V05 — Remaining account eligibility and correction combinations

### Issue

**Partially verified matrix.** Selected nonexistent/wrong-branch other-income
(`SALES`) create/sync and EXPENSE source requests rejected; valid bank metadata was canonicalized;
valid updates and rejected-update preservation passed. Remaining work concerns
B15, non-posting/foreign-company accounts, protected BANK changes, child-account
allocation and remaining cash/payment-method correction paths.

The reviewed account model exposes `nonPosting` but no universal account
`active` field. An “inactive-account” test is conditional on an actual documented
lifecycle state; its absence is not by itself a request for a new activation API.

### Expected result

**Confirmed use-case distinction:** income includes invoice receipts and other
income for this operational workflow. The current **Register income** action
records other income outside initial and subsequent invoice payments; its existing
API transaction type is `SALES`.

**Recommended portal presentation:** group income entry and reporting as follows,
and rename the current action to **Register other income**:

```text
Income
├── Invoice payments
│   ├── Initial payment with invoice registration
│   └── Payment on an existing invoice
└── Other income
```

Invoice registration remains available under Invoices because it may involve
no money received. When an initial receipt accompanies registration, include only
that receipt amount under Income → Invoice payments. This presentation is portal
work, not a claim that the current UI has already changed.

| Portal use case | API transaction type | Purpose |
| --- | --- | --- |
| Register other income (currently Register income) | `SALES` | Other income outside initial/subsequent invoice payments |
| Register new invoice / initial payment | `INITIAL-PAYMENT` | Invoice registration and any initial receipt; registration may have zero payment |
| Register invoice payment | `PAYMENT` | A subsequent receipt against an existing invoice |

Do not use Register other income as a shortcut for invoice collections: their dedicated
workflows own invoice linkage, payment/balance effects and replay behavior. Test
the relevant account rules for each use case separately; the matrix is a
verification checklist, not a request to merge the workflows or rename the API.

For operational Income summaries, count actual receipt amounts from the applicable
workflows, not full invoice values or zero-payment registrations. Distinguish
registered, internally reconciled and cleared amounts; do not count the same
receipt again when it reconciles or clears. Preserve currency distinctions.

Each posting path resolves authoritative references and validates its documented
eligibility rules. Branch-local restrictions coexist with permitted global/system
accounts; “different branch” is not a universal rejection rule for every account.

Corrections adjust only the intended financial/receipt effects, without duplicate
application, cross-period movement or partial writes. BANK/system protections
follow the actual contract. Missing versus explicit null, zero and false retain
their documented meanings.

### Suggested action

#### API work

1. Enumerate remaining account/operation combinations for invoice payments
   (`PAYMENT`), other income (`SALES`), registration/initial receipts
   (`INITIAL-PAYMENT`) and expenses (`EXPENSE`) on applicable create/sync/update/
   correction paths after B15 is fixed.
2. Enforce authoritative eligibility and BANK/system protections, allowing
   documented global accounts and applying branch restrictions only where required.
3. Identify a documented inactive/retired mechanism before proposing that test.
   If none exists, ask whether it is needed; do not invent an active field/API.
4. Keep `SALES`, `INITIAL-PAYMENT` and `PAYMENT` contracts distinct. The proposed
   Income parent/subcategories do not require a new endpoint or transaction enum.

#### Database work

1. Prepare isolated positive/negative account fixtures for non-posting, missing,
   foreign-company and specifically restricted branch cases. Inspect real saved
   references and supported lifecycle fields instead of manufacturing unsupported ones.
2. Compare source versions, accounts, ledger entries, invoice receipt effects and
   period membership before/after corrections or rejection. No specific schema
   change is established by the remaining verification matrix.
3. Keep child-code allocation/ancestry and any migration work under I04 rather
   than duplicating it as a second account migration requirement.
4. Do not introduce a storage category or migrate transaction types solely for
   the portal grouping/label change. Existing stored types retain their meanings.

#### Both — API and database together

1. Execute the remaining operation/eligibility matrix with valid positive controls,
   then inspect persisted effects. Reuse the already passing selected missing/
   wrong-branch, canonicalization and rejected-update controls as regressions.
2. Verify remaining selected-cash/source and payment-method/account corrections
   with no duplicate application, cross-period movement or partial writes.
   `chart_account/model_test.go` is a starting point, not full database proof.
3. Verify any combined Income view against the existing reporting contract:
   initial receipts, subsequent invoice payments and other income aggregate once,
   with currency/status distinctions, without adding invoice totals or zero-value
   registrations. Coordinate the menu/label changes with portal owners; report
   any missing server aggregation capability separately from this presentation.

## V13 — Controlled closeout boundaries and legacy OPEN treatment

### Issue

**Partially verified; legacy handling policy confirmed.** NY context reported
STALE_OPEN_CLOSEOUT and posting returned 409 CLOSEOUT_REQUIRED. With explicit
user approval, normal rollover created current period **32738** and closed
**32736**. Legacy uppercase **OPEN period 4** remained open. DR context reported
LATEST_CLOSED, but no DR-actor posting rejection was tested.

Remaining verification concerns in-flight midnight/DST crossings, concurrent
rollover/first writes, cross-period rejection and failure rollback. An ordinary
successful rollover does not establish these controlled cases.

### Expected result

The server business calendar and branch scope determine the current period.
Writes cannot be posted into an ineligible historical period. Authorized explicit
opening must not create duplicate current periods or partially close/open/post.
Manual close/reopen is not assumed available; the tested manual close returns 409.

**Confirmed modeler decision — November 14, 2026:** legacy periods are handled
separately through a one-time migration, not normal rollover. Period 4 remaining
OPEN is therefore not a normal-rollover defect by itself. The migration has not
been implemented or executed by this review.

RD/DR/DO currency/rate setup must use the explicit current contract/configuration;
an old peso/60 row is not proof of today's policy. Other-branch USD/rate-1 behavior
must follow the actual branch rule, not an inferred universal default.

### Suggested action

#### API work

1. Keep current-period selection and new-entry cutoff authoritative to the server
   business calendar and branch. Do not make normal rollover finalize legacy periods.
2. Verify the remaining DR-actor LATEST_CLOSED rejection with valid positive
   controls and explicit currency/rate setup. NY stale rejection/normal rollover
   already passed; do not label those basic paths as unresolved defects.
3. Document disabled manual close/reopen behavior and confirm retired scheduler
   entry points are not performing unauthorized lifecycle mutations in deployment.

#### Database work

1. Have backend migration owners document the separate one-time legacy-period
   migration: eligibility/cutoff, status/date normalization, historical transaction
   amounts/links and summary treatment, audit attribution, dry-run reconciliation,
   safe reruns/recovery and rollout ownership. Casing alone is not migration scope.
2. Preserve original transaction IDs, dates, amounts and financial/audit associations.
   Document any derived-summary rebuild explicitly; this is an operational daily
   closeout, not a mandate for immutable accounting-period snapshots.
3. Inspect the existing current-period uniqueness/serialization mechanism and
   legacy records before proposing indexes or backfills. Review the migration
   plan before execution; this decision does not authorize a live migration.

#### Both — API and database together

1. Extend `income_statement/end_of_day_integration_test.go`,
   `TestExplicitCloseoutRolloverIntegration`, using a controlled financial clock
   for in-flight writes, concurrent opening and midnight/DST boundaries.
2. Inject closure/creation/posting failures; prove complete rollback, correct
   membership/source versions and no duplicate period. A route-clock test is not
   a substitute for the closeout clock.
3. Verify that post-closeout reconciliation/clearance follows V02 without opening
   the old entry day. Coordinate legacy migration with I03 history owners;
   legacy period 4 remaining OPEN is not itself a normal-rollover defect.

## I04 — Account templates, allocation and retained mappings

### Issue

**Environment/migration and allocation verification.** The bounded live catalog
lacked eligible layer-3 1300–1399 loan parents, blocking creation of a new account
in an isolated branch. Existing legacy NY LOAN account 7 nevertheless supported
the verified lifecycle. Missing master templates do not establish that existing
loans are unusable or that a tenant-wide migration is already authorized.

The reviewed source defines parent/layer/range/cycle rules. Mock allocator tests
do not establish real-database occupied/exhausted/concurrent code behavior or
preservation of retained historical mappings.

### Expected result

For new template-based LOAN leaves, source expects a permitted layer-3 parent and
an explicit available four-digit code in 1300–1399. BANK automatic allocation is
a different path; do not apply it to LOAN or cash children by assumption.

Allocation obeys documented parent/type/layer/range limits and safely rejects
cycles, invalid ancestry or exhaustion without partial trees. Existing identifiers,
historical postings and valid legacy accounts remain usable. No ambiguous legacy
mapping is silently rewritten and no blanket reseed/reset is implied.

Whether existing tenants must migrate to the master chart, and how legacy
mappings should be resolved, must be confirmed before implementation. Source
validation limits describe current behavior, not a mandate for arbitrary-depth trees.

### Suggested action

#### API work

1. Confirm and publish the supported account-creation model: parent/type/layer,
   code ranges, explicit versus automatic allocation and rejection semantics.
   BANK automatic allocation does not imply automatic LOAN/cash allocation.
2. Validate documented ancestry/cycle limits and protections for existing
   system/legacy accounts. Do not turn source validation limits into a demand for
   arbitrary-depth trees or reopen B12's passing existing-account lifecycle.

#### Database work

1. Determine whether existing tenants retain the legacy chart or receive a master-
   template migration. This rollout/design decision is still unconfirmed; do not
   blindly reseed/reset retained data to fix an isolated fixture prerequisite.
2. If migration is selected, document missing template seeds, retained ID/code and
   historical mapping treatment, uniqueness/index requirements, dry-run checks,
   safe reruns/recovery and rollout. Preserve valid legacy accounts and postings;
   return ambiguous mappings to the modeler before changing them.
3. Use a disposable real database for occupied/exhausted ranges, allowed parents/
   layers, cycles and concurrent code reservation. Mock allocator results are not
   proof of database allocation safety.

#### Both — API and database together

1. Exercise concurrent API account creation against real storage; prove codes/IDs
   obey the selected contract with no duplicate allocation or partial account tree.
2. Reconcile identifiers, historical postings and roll-ups before/after any approved
   migration, and verify existing accounts remain usable through API reads/posting.
3. Start from `chart_account/repository_test.go`,
   `TestChartAccountAllocationReservesSystemIDs`, and `prepareFundingChild`.
   Separate code changes needed from verification that already-correct behavior passes.

## Evidence and execution requirements

Verified results summarized above include the isolated run's **102 passing
financial assertions and one reproduced B15 failure**, plus the active NY loan,
invoice and rollover readbacks. Loan harness assumptions about INCREASE type and
explicit raw zero balance were corrected against actual source/wire semantics;
they are not backend defects. No new live tests ran for this document restructure.

For backend HTTP acceptance, use a Firebase JWT in Authorization: Bearer and an
authorized x-company-id, with actual grants/company/branch scope. Do not modify
existing user roles or shared periods merely to create negative tests. Use new
mock records and approved isolated environments for fault/clock controls.

Reviewed Go/Mongo suites require a disposable loopback replica set with
`APP_ENV=codex`, `RUN_INTEGRATION_TESTS=true`, `DATABASE_NAME=emsys_codex_test`.
Financial/loan suites use `EMSYS_FINANCIAL_CONTROLS_TEST_URI`; closeout fixtures use
`QUALITY_TEST_MONGO_URI` and require empty branch/settings collections. Inspect
current fixture guards/cleanup and run families serially. These backend suites
were not executed in the portal review environment.

For each ID, return source/deployed revision, environment/date, actor grants and
company/branch context, exact sanitized payload/response, persisted before/after
state, rejection/rollback/replay outcomes, executed versus skipped tests and any
remaining decision. Include relevant evidence directly in the returned Markdown;
links to inaccessible portal files are insufficient. Distinguish implementation,
source presence, deployed acceptance, publication and portal activation.
