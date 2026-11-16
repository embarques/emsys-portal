# Barcodes, status workflow, routes and delivery

Standalone backend handoff. Updated November 14, 2026.

Scope: **B16, V06, V07, V11, I01**. Each ID uses **Issue → Expected result →
Suggested action**, with actions split into **API work**, **Database work** and
**Both — API and database together**. No other portal files are required.

- **API work:** commands, validation, permissions, request/response contracts and
  publication. A desired model is not a claim of deployed behavior.
- **Database work:** persisted-state inspection, constraints/indexes and justified
  data migrations. Verification alone does not imply a schema change.
- **Both:** end-to-end consistency, atomicity, concurrency and compatibility across
  the API and stored data. Portal dependencies have a separately identified owner.

Source observations refer to API commit
`4fdef23abcbaa89778d9ea6ca2d8f28b633cd270`. Live findings were captured November
13–14, 2026. Endpoint paths are relative to `/v1`; backend source paths are optional
starting points in the recipient's own repository. This restructure adds no
runtime verification, closes no ID and changes no API/database implementation.
The API reference remains read-only.

## B16 — Status writes, explicit defaults and transition controls

### Issue

**Confirmed readback mismatch plus remaining implementation/integration.** In
configured active NY branch 1, newly generated pieces correctly received its
configured default status 1. That creation path is verified, not an open blanket
missing-default defect. Earlier empty defaults in synthetic branches were a
different configuration prerequisite; ALM-NY is not a universal fallback rule.

An explicit embedded update sent `{status: {id: 6, name: "CONDUCE"}}` with the
invoice version. PUT succeeded and route assignment persisted, but the requested
status did not survive readback. This establishes a write/response mismatch;
direct database inspection is still needed to distinguish an ignored/unsupported
patch from persistence or projection faults.

Unconfigured-generation blocking, administrator-only branch default selection,
workflow catalog controls and remaining portal hardcoded fallbacks are not yet
fully implemented/verified. Source default lookup alone does not establish them.

### Expected result

Every branch has an explicit valid default label status from its applicable
catalog. Only administrators configure it; general branch-update permission alone
does not establish that authority. No first-step or ID-1 fallback is inferred.
Generation with missing/invalid configuration is blocked without losing the draft.

Supported status changes persist consistently across invoice-embedded and catalog
copies. Unsupported writes must be explicitly documented/rejected rather than
silently accepted without the requested effect.

Keep the shared core CONDUCE **6** / ENTREGADO **7** across companies. DEV-RD **5**
is the normal returned state. Additional pre-CONDUCE steps use a dedicated workflow
management permission, separate from administrator-only branch default selection.
Preserve extensions through seeds/upgrades; numeric ID order is not workflow order.

**Selected assignment target:** daily delivery-route assignment also sets CONDUCE
atomically with delivery/trip membership. Standalone status edits remain separate
and do not implicitly assign/remove a route. **Suggested return contract:** an
explicit Return/unassign command clears current membership and sets DEV-RD;
direct reassignment retains CONDUCE on the destination. Define command/retry and
lifecycle details before rollout; these recommendations are not deployed claims.

### Suggested action

#### API work

1. Diagnose the successful embedded CONDUCE request against supported write rules.
   Fix persistence/projection or explicitly reject an unsupported status patch;
   publish the actual contract for catalog and embedded paths.
2. Enforce valid branch defaults before generation and administrator-only default
   configuration. Return actionable setup errors. Define the separate workflow-
   catalog permission/transition contract without inventing a permission wire name.
3. Specify/implement atomic assignment-status behavior and the proposed explicit
   return/reassignment commands. Preserve delivered locks and generic status-edit
   semantics; avoid two independently committing requests for a single operation.

#### Database work

1. Inspect invoice embeds, catalog rows, branch settings and status catalog after
   writes to locate the readback discrepancy. Do not assume every missing response
   field is a lost database write or requires a migration.
2. Validate existing branch default references and core/custom status records.
   Preserve fixed IDs and extensions during seed/upgrade; do not silently set
   every unconfigured branch to 1 or choose the first catalog entry.
3. If stored references or data need repair, document affected records, validation,
   audit preservation and safe reruns before changing them. Assignment/status/
   membership updates must leave both stored copies consistent.

#### Both — API and database together

1. Retain configured-NY creation as a regression. Add missing/invalid configuration,
   admin/non-admin and workflow-grant controls; verify rejection leaves drafts/
   persisted records intact and successful status changes agree in both copies.
2. Exercise assignment, return and reassignment using actual CONDUCE/delivered
   states and nonempty membership, including rejected transitions and retries.
3. **Portal dependency:** replace remaining NEW_BARCODE_STATUS fallbacks with
   authoritative branch/catalog resolution and permission-gated selection. Preserve
   drafts; direct admins to Branches → edit branch → Settings → Default label
   status, and other users to an administrator. API enforcement remains mandatory.

## V06 — Piece identity, bulk eligibility and shared-trip integration

### Issue

**Unresolved identity/eligibility and incomplete agreed-model integration.**
Embedded numeric IDs are invoice-local sequences and differ from catalog IDs.
The reference bulk resolver matches numeric embedded IDs globally before owner
validation, so a unique owned-record positive control is required before writes.
Moving to active NY/DR branches does not remove this ambiguity; no unsafe numeric
mutation was sent during the active-branch follow-up.

Earlier matched branch/container and RD controls returned eligibility 400;
missing-ID mixes returned 400 rather than the reported 404 contract. Empty,
duplicate and 201-ID requests rejected without changes. A bounded 200-row catalog
prefix lookup exceeded the 30-second client timeout. These observations do not
certify valid bulk assignment or complete rollback/replay behavior.

Permanent printed identity and one shared trip per daily route are selected
model targets. Current per-container trip behavior, non-unique seeded number index
and only partial number immutability do not establish the target implementation.

### Expected result

The full printed barcode `number` stays a **string**, immutable and unique across
the company. **Permanent non-reuse is confirmed:** deletion or void never releases
that number for different merchandise. **Backend clarification November 16:** the
existing increasing sequence is the correct mechanism. Deletion leaves the counter
where it is; future allocations move forward and deleted numbers stay retired.
The reservation-table proposal is withdrawn. Remaining verification is that
imports/reseeds preserve the counter without moving it backward and concurrent
allocations advance it atomically. This clarification is not new test evidence.
Reprints/exact retries for the same piece keep its identity.

Use printed numbers for the selected target piece operations. Retiring embedded
numeric IDs or barcodeId as business/API identities requires explicit compatibility
and migration of every consumer/history reference first; no identifier removal
is authorized merely by describing the target.

**One daily delivery route = one shared delivery/trip**, which can contain pieces
from multiple shipping containers. Further batches join that trip without a
separate open-trip selection or per-batch allocation. Assignment adds membership,
unassignment clears it and reassignment replaces it. Each piece retains its
original shipping container and historical receipts.

During compatibility, `PUT /invoices/item/barcode/route/{routeId}` reportedly
accepts 1–200 distinct positive uint32 IDs, with duplicate 400, missing 404 and
delivered/conflict 409, all-or-nothing. Its resolved identity and eligibility must
be explicit. Legacy successful replay may allocate another trip today; publish
that compatibility behavior separately from the future shared-trip guarantee.

### Suggested action

#### API work

1. Define current numeric resolution and exact branch/container eligibility;
   establish a safe successful control before interpreting the negative matrix.
2. Specify the printed-number command/lookup contract, errors and compatibility
   rollout. Do not substitute number strings into endpoints still expecting numeric IDs.
3. Align assignment/review/completion/signatures/listing with authoritative shared-
   trip piece membership. Replace single-container assumptions with membership
   checks rather than simply deleting container validation.
4. Resolve the bounded lookup failure using an appropriate scoped lookup/list
   contract; do not add directory downloads or per-row detail lookups as a workaround.

#### Database work

1. Inspect company-scoped number collisions, mutability and actual indexes before
   designing unique enforcement. Document how conflicting legacy records are
   resolved; do not guess which merchandise an old label identifies.
2. Retain the existing increasing barcode sequence; deletion/void must not lower
   its counter or make retired numbers available again. Verify imports and reseeds
   preserve the counter, including when the highest allocated piece was deleted;
   do not rebuild it solely from surviving rows. Verify concurrent allocations
   advance it atomically and receive distinct new numbers. No reservation table
   is required by this handoff.
3. Document the compatibility/migration mapping among embedded sequences, catalog
   IDs, barcodeId, printed numbers, legacy delivery IDs and shared-trip membership.
   Preserve original containers, signed receipts, histories and retry associations.
4. Inspect lookup plans with representative approved data; an index's existence
   alone does not prove use or acceptable latency.

#### Both — API and database together

1. Migrate scanner lookup, catalog/embed selectors, print/report lookup, invoice
   removals, bulk assignment, completion/signatures and replay consumers before
   retiring old identities. Validate retained references before/after migration.
2. After a positive control, exercise missing/foreign/wrong-branch/invalid-container/
   delivered/duplicate mixes and failure/replay; compare every selected piece,
   both copies and trip membership for complete rollback or one correct result.
3. Verify additional batches and exact retries join the same selected shared trip,
   across containers. Keep current compatibility and target behavior separately
   evidenced. Start from `delivery/workflow_integration_test.go`,
   `TestDailyRouteBatchAndHistory`; a seeded fixture is not real-adapter acceptance.

## V07 — Movement, removal, reassignment and legacy-piece lifecycle

### Issue

**Remaining actual-state/race verification.** Versioned embedded assignment,
explicit route:null removal and catalog mirror agreement passed, including in
configured current NY. Those basic paths are not unresolved blanket defects.

Requested CONDUCE did not persist in the embedded test (B16). Earlier delivery
fields were absent, so preserving empty fields did not establish correct nonempty
membership/trip behavior. Actual CONDUCE/delivered locks, explicit return,
reassignment, legacy pieces and completion/movement races remain unverified.

### Expected result

For current wire compatibility, omitted route preserves the assignment and
`route: null` explicitly removes an unfinished assignment. Delivered-state and
source/destination business-date protections remain enforced by the API.

For the selected shared-trip target, movement/removal/reassignment changes current
membership appropriately while retaining original shipping provenance, historical
assignments and signed receipts. Further assignment batches do not create another
trip for the same daily route. The explicit Return/unassign and DEV-RD behavior
must use the concrete command contract agreed under B16.

A completed piece cannot have completion/status/attribution overwritten by a
concurrent movement. Catalog and embedded views must remain consistent, including
legacy invoice-only pieces. Do not interpret earlier empty-field preservation as
a requirement to keep obsolete numeric membership after target unassignment.

### Suggested action

#### API work

1. Publish actual omission/null, delivered-lock, date and return/reassignment
   semantics for each compatibility/target command. Do not infer unassignment
   from every generic status edit.
2. Use the authoritative server business clock. `GET /vehicle-routes/business-date`
   accepts optional branchId and returns data.businessDate, timezone, serverTime
   and nextMidnight; assigned crews can use it without a financial closeout grant.
3. Define conflict/retry behavior for stale movement versus completed pieces,
   retaining scope and version controls on both catalog and embedded paths.

#### Database work

1. Build isolated fixtures with real nonempty trip/membership and status 6/7,
   plus legacy invoice-only pieces. Preserve historical references and provenance.
2. Compare old/new membership, status, container, manifests, analytics attribution
   and signed-receipt associations after each command. No schema change is assumed
   merely because the earlier fixtures had empty delivery fields.

#### Both — API and database together

1. After B16/V06 prerequisites, test move/remove/return/reassign on catalog and
   embedded paths with real CONDUCE/delivered states and all required mirrors.
2. Race completion against movement/removal in both commit orders. Prove one
   valid result or conflict, with no overwritten completion or partial history.
3. Reuse `delivery/workflow_integration_test.go`:
   `TestCatalogAssignmentFeedsDeliveryCompletion`,
   `TestEmbeddedAssignmentFeedsDeliveryReview`,
   `TestCompletionAndDailyRouteAssignmentRace` and
   `TestLegacyInvoiceOnlyPieceRouteRemoval`. Existing source tests were not run
   in this portal review and may need shared-trip fixture updates.

## V11 — Scoped delivery completion and payment enforcement

### Issue

**Unverified completion cases and incomplete shared-trip integration.** Remaining
cases cover authoritative balance/uncleared receipts under concurrent financial
changes, agreement/signature/photo ownership, actual assigned-only and multiple-
actor scope, tampered/foreign/stale pieces and completion replay. Existing
single-container fixtures do not establish the selected mixed-container trip model.
Source route/test presence is not deployed acceptance of every scenario.

### Expected result

Completion is invoice-scoped within the shared trip and validates authoritative
piece membership, actor, company, branch and assignment. Reject foreign,
duplicate, stale or mismatched pieces without partial effects.

Completion requires authoritative **finite invoice balance exactly zero** and
**no linked uncleared receipts**. Cash receipts apply immediately; bank receipts
apply through clearance. Internal reconciliation does not clear bank receipts or
apply their deferred invoice payment. Clearance reconciles as well as settling.
There is no uncleared-payment override; a reconciled-but-uncleared bank receipt
must not bypass the completion gate. Payment and delivery cancellation remain
independent workflows.

Enforce the applicable policy agreement, collector-owned optional photos, private
signature storage and metadata-only reads. Rejected completion saves no receipt.
Exact UUID replay, including concurrent calls, returns the committed result
without duplicate receipts, signatures or delivery effects.

### Suggested action

#### API work

1. Validate current invoice balance, uncleared receipts, piece membership and
   actor/assignment scope on the server, including tampered client values.
2. Align review/completion/signature/list contracts with the shared-trip mapping
   under V06. Do not replace delivery identity with a similarly named route ID
   before compatibility is defined.
3. Enforce agreement, optional-photo ownership, signature access and exact replay
   semantics. Publish actual payloads, grants and error behavior; do not invent
   an override or endpoint from desired UI behavior.

#### Database work

1. Verify invoice/receipt eligibility reads and completion writes participate in
   the required atomic consistency mechanism under concurrent finances.
2. Inspect completion/replay identity, receipt/signature/photo associations and
   history for duplicate or rejected-operation effects. Verify existing storage
   protections before proposing schema/index changes.
3. Preserve private media/signature data and metadata projections through any
   shared-trip/identity migration; retained receipts keep their original references.

#### Both — API and database together

1. Establish a valid completion control, then test broad/assigned-only users,
   multiple actors, revoked crew, foreign companies/branches and invalid pieces.
2. Cover nonzero, negative, unavailable/nonfinite balances and uncleared receipts,
   including internally reconciled bank receipts still awaiting clearance.
   Race financial changes against completion and inspect persisted results.
3. Test agreement, collector-owned optional photos, rejected signatures/receipts
   and concurrent UUID replay. Start from
   `delivery/completion_balance_integration_test.go` and workflow scope/photo/
   authorization tests; source fixtures alone do not close these live cases.

## I01 — Dependent-write, clock and commit-window boundaries

### Issue

**Controlled backend verification remains unavailable/unexecuted.** Complete
rollback still needs proof across invoice/pickup bulk assignment, invoice patches,
trip membership, catalog/embed synchronization and delivery-versus-movement/removal.
Business-midnight and in-flight authorization/crew changes are distinct from
ordinary pre-action rejection. Go/Mongo test sources were located but not run.

### Expected result

A failed dependent write leaves no partial assignment, patch, membership,
completion, receipt or success history. Retry follows the applicable command's
published identity semantics; do not assume the legacy numeric endpoint already
has the selected shared-trip replay guarantee.

Eligibility must remain consistent through commit under server midnight/DST,
queued/in-flight work, relevant financial changes and assignment/authorization
changes. Use controlled test clocks/barriers; browser time or ordinary revoked-
access checks are not proof of the commit window. Record the agreed authorization
ordering policy rather than assuming cache invalidation makes in-flight work safe.

### Suggested action

#### API work

1. Identify actual command transaction boundaries, date/eligibility rechecks,
   version conflicts, retry rules and error responses. Define any unresolved
   authorization ordering with the relevant owner before certifying behavior.
2. Provide test-only clock/barrier/failure controls in an isolated environment;
   do not expose bypasses or inject failures into shared live work.

#### Database work

1. Identify all dependent writes, history/outbox effects and contention/locking
   mechanisms for each command. Verify rollback/consistency against actual stored
   records rather than response status alone.
2. Prepare isolated legacy/current identity, mixed-container membership and clock-
   boundary fixtures. Validate existing indexes/constraints/serialization before
   introducing new ones; a separate migration is not assumed for test coverage.

#### Both — API and database together

1. Inject failure between assignment, embed/catalog, membership, history and
   completion writes. Compare full before/after state and retry outcomes.
2. Cross business midnight during in-flight and queued writes, including additional
   invoice-patch reads, timezone disagreement, clock skew and DST cases.
3. Use commit barriers for completion/movement and grant/crew revocation in both
   orders. Coordinate I02 authorization guarantees; do not infer them from a
   token/grant revoked before request start.
4. Extend workflow `TestDailyRouteBusinessMidnightRollback` and invoice-handler
   `TestCreateInvoiceRollsBackWhenInvoiceDetailsFail`. Align fixtures with the
   agreed identity/shared-trip model before treating their assertions as acceptance.

## Execution and completion evidence

Use approved isolated fixtures. HTTP acceptance requires a Firebase JWT in
Authorization: Bearer and an authorized x-company-id, plus actual resource/action
permissions and company/branch/assignment scope. Direct service tests and hidden
portal buttons do not establish HTTP enforcement. Do not mutate existing records
or retained signatures/history to force a negative control.

Reviewed backend integration suites use a disposable loopback MongoDB replica set
with `APP_ENV=codex`, `RUN_INTEGRATION_TESTS=true`,
`DATABASE_NAME=emsys_codex_test`. Delivery workflow/completion use
`EMSYS_WIZARD_MONGO_URI`; invoice sync fixtures use `EMSYS_INVOICE_SYNC_TEST_URI`;
route-policy/financial authorization families use
`EMSYS_FINANCIAL_CONTROLS_TEST_URI`. Inspect each fixture's current guard/cleanup,
run families serially and report skipped tests. These Go/Mongo suites were not
executed in the portal review environment.

Return a Markdown report for each ID containing source/deployed revision,
environment/date, actor grants/company/branch/assignment context, exact sanitized
payload/version/retry fields and responses, persisted before/after state, mirror/
history comparisons, failure/replay/concurrency results and executed/skipped cases.
Include relevant plans/load/budgets for lookup changes; an index alone is not a
performance claim. Include evidence directly, not links to inaccessible portal
files. Distinguish verified controls, required implementation, publication and
portal rollout. Keep failed/unverified/unimplemented variants open and return
unresolved model questions before inventing a command or migration.
