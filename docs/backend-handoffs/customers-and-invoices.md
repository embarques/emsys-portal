# Customer identity, invoice registration, deletion and reserved numbers

Standalone backend handoff. Updated November 14, 2026.

Scope: **V08, V09, V10, V14**. Each ID uses **Issue → Expected result → Suggested
action**, with actions split into **API work**, **Database work** and **Both — API
and database together**. No other portal files or evidence attachments are
required to understand the assignment.

- **API work:** requests, permissions, business validation, responses and published
  contracts. An untested case is not automatically a confirmed defect.
- **Database work:** persisted-state verification, controlled fixtures and justified
  indexes/migrations. A verification task does not itself require a schema change.
- **Both:** API behavior and saved-state consistency, replay, concurrency and safe
  handling of retained history. Portal dependencies remain separately identified.

Endpoint paths are relative to `/v1`. Source observations refer to API commit
`4fdef23abcbaa89778d9ea6ca2d8f28b633cd270`; live results were captured November
13–14, 2026. Backend source paths are optional starting points in the recipient's
own repository. This restructure adds no runtime tests, closes no ID and changes
no API/database implementation. The reference clone remains read-only.

## V08 — Payment-gated invoice deletion and eligible hard deletion

### Issue

**Confirmed deletion gate and scope; implementation/verification need alignment.** The
modeler states that invoice deletion is not allowed until linked payments have
been deleted through their supported workflow or reversed. An invoice without
active payments can be eligible for complete deletion.

Earlier private-document and missing/stale-version rejection controls passed;
ordinary deletion succeeded after document removal. Those controls do not prove
the confirmed payment gate or complete deletion/retention behavior. No new live
probe or historical deletion was performed for this policy clarification.

### Expected result

The API rejects invoice deletion while any linked payment remains active. This
includes partial payments and uncleared bank receipts; a zero invoice balance,
internal reconciliation or a client-reported paid amount alone cannot establish
delete eligibility. Payment deletion/reversal happens first through its actual
supported lifecycle, not an implicit bypass inside invoice deletion.

| Linked payment state | Financial deletion gate |
| --- | --- |
| Active payment, including a partial or uncleared receipt | Block invoice deletion |
| All payments deleted through supported workflows or reversed | Gate satisfied; apply the remaining agreed deletion rules |
| No payments | Gate satisfied; apply the remaining agreed deletion rules |

Denied deletion preserves invoice/version, documents, pieces and financial state.
Payment-state validation and invoice deletion must be safe against concurrent
payment creation or state changes; an earlier UI check is insufficient.

**Confirmed deletion scope:** remove the eligible invoice and its operational
data, while retaining payment, journal, reversal and financial audit history.
“No trace” applies to the removed operational invoice, not its retained financial
history. Retained records must remain attributable to the original invoice through
stable references/snapshots without depending on a live invoice record. Deletion
must not cascade into financial history or change its amounts or effects.
Document the operational cascade, including pieces and attachments, and align
existing document guards/cleanup with it. This decision does not authorize a
historical purge or deletion of independent customer/directory records.

**Existing confirmed identity rule:** printed merchandise barcode numbers stay
retired after deletion/void so old labels cannot identify different merchandise.
Backend clarification November 16: retain the existing increasing sequence;
eligible invoice deletion leaves its counter unchanged. The reservation-table
proposal is withdrawn. Verify imports/reseeds preserve the counter and concurrent
allocations advance it atomically. This does not establish
a reserved invoice-number recycling policy. A zero-payment registration is not
money received; distinguish its registration record from an actual linked payment.

### Suggested action

#### API work

1. Enforce the linked-payment gate from authoritative saved payment state on
   DELETE /invoices/{id}, with current permissions/version handling and a clear
   rejection reason. Publish eligible deleted/reversed states without inventing
   new payment hard-delete endpoints or treating display totals as the authority.
2. Publish and implement eligible operational hard deletion and financial-history
   retention: identify document/piece cleanup and the retained payment/journal/
   reversal/audit read model. Existing document guards are observed behavior;
   align their cleanup flow with this confirmed scope rather than
   assuming that policy is already implemented.
3. Keep payment deletion/reversal as the supported prerequisite operation and
   preserve failed-delete state. Identify the remaining registration-only case
   explicitly instead of classifying a zero receipt as an active payment.

#### Database work

1. Seed isolated no-payment, active/partial/uncleared-payment and fully deleted/
   reversed-payment fixtures. Snapshot invoice versions, payment effects,
   documents, pieces and financial/audit associations before each case.
2. Inspect payment links and deletion/cascade behavior. Preserve financial records
   and their original invoice attribution through durable references/snapshots;
   operational cleanup must not cascade into those records. No blanket historical
   cleanup or schema migration is authorized by this handoff.
3. Verify eligible cleanup leaves the existing barcode sequence counter unchanged
   and future allocations move forward. Coordinate with logistics owners to verify
   imports/reseeds preserve that counter, including deleted high numbers, and
   concurrent allocations advance it atomically. Do not add a reservation table.

#### Both — API and database together

1. Prove active payments block deletion with unchanged persisted state. Delete or
   reverse only owned mock payments through supported commands, then verify the
   invoice can pass the financial gate with a fresh version.
2. Race payment creation/state changes against invoice deletion; verify a consistent
   result with no orphan active payment, partial deletion or duplicate application.
   Check rollback if dependent cleanup fails.
3. For allowed deletion, prove the operational invoice/dependents are removed,
   financial history and attribution survive, and deleted printed numbers stay
   retired with the sequence counter unchanged.
   For denied cases, prove unchanged state. Extend
   `delivery/workflow_integration_test.go`,
   `TestInvoiceDeletionVersionDocumentsAndDependents`; its existing document/
   version checks alone do not certify this gate or full deletion scope.

## V09 — Address-only edits on legacy duplicate customer identities

### Issue

**Unavailable legacy fixture, not a reproduced ordinary-edit defect.** Ordinary
customer create, address-only update and identity-conflict rejection passed;
rejected edits preserved the customer. What remains is an address-only update
when legacy duplicate identity records already exist and have linked history.
Normal validated creates cannot manufacture that legacy condition.

Reviewed duplicate matching uses name plus a matching normalized phone. Address-
only, name-only or phone-only matches are insufficient. This describes source
behavior; it is not permission to merge or rewrite historical customers.

### Expected result

A customer may have linked appointments, invoices, shipments and merchandise.
Address-only changes target the selected stable customer ID and preserve its
protected identity fields and history associations. They must not select another
duplicate, create a replacement or implicitly merge customers.

A genuine conflicting protected-identity change follows the documented rejection
rule without partial writes. Historical address snapshots follow their own
contract; editing today's address does not imply rewriting past documents.
Omitted fields remain unchanged and tenant access stays authoritative.

Any ambiguity in identity rules or legacy migration needs a concrete modeler
decision. V09 does not itself authorize deduplication, a new matching algorithm
or a production data cleanup.

### Suggested action

#### API work

1. Review customer update validation/partial-update handling using stable IDs and
   the current DTO. Preserve omitted identity fields on address-only edits.
2. Confirm conflict detection excludes the edited record and does not turn the
   presence of pre-existing legacy duplicates into an unrelated address-edit error.
   Change code only where a failing fixture establishes a mismatch.
3. Publish supported update/conflict/scope behavior and distinguish current
   customer addresses from historical snapshot semantics.

#### Database work

1. Directly seed isolated legacy duplicates using source-recognized identity/
   normalization fields, with distinct customer IDs and separately identifiable
   appointment/invoice history. Do not weaken ordinary create validation.
2. Snapshot both identities, addresses and all linked IDs. Verify the target edit
   preserves the other duplicate and every original association/history record.
3. Treat any actual deduplication/migration as separate reviewed work. Do not add
   an index or repair that merges/removes retained duplicates merely to make the
   test fixture disappear.

#### Both — API and database together

1. Address-edit each duplicate through the real API, then read both customers and
   inspect linked records. Only the requested address should change.
2. Attempt a genuine conflicting identity change and a foreign-company request;
   verify documented rejection and unchanged records/history with valid controls.
3. Reuse `customer/duplicate_test.go`, `customer/address_migration_test.go` and
   `customer/delete_integration_test.go` as adjacent source fixtures. Their
   presence is not execution or acceptance of this exact legacy case.

## V10 — Remaining invoice ownership, registration and payment variants

### Issue

**Partially verified; only remaining variants are pending.** Active NY branch 1,
after approved rollover to period 32738, established ordinary unpaid digitization
and configured default piece status. Employee receivedBy and non-DR pickup-route
receivedBy passed, without nested crew or replacement of existing piece identities.

A new zero-payment financial registration completed from PENDING via the real
portal PUT with original invoice ID/number, cost/balance $0.02, payment zero and
two generated pieces. Replaying its registration kept original journal/invoice
identities. Nine additional receivedBy/completion/replay assertions passed.

Remaining cases: assigned-only own/foreign pickup/customer controls, grant/
assignment revocation, broader initial-payment/bank-clearance effects and actor
contexts. The old unavailable branch-11 fixture is superseded by valid active NY;
there is no special branch-11 business requirement. NY does not certify DR behavior.

### Expected result

Invoice digitization records collected/received merchandise. Pending financial
registration and completed digitization retain the same underlying invoice,
customer associations and authoritative financial state, without fabricated or
reapplied payment. Amounts already controlled by a journal are not overwritten
from submitted form totals during completion.

`receivedBy` identifies an eligible non-DR daily route or a single employee from
a non-DR branch who took in merchandise. Daily-route references use id/name with
no nested crew. `createdBy` is the digitizer; createdAt is digitization time and
updatedBy/updatedAt describe the last edit. A piece's DR delivery route is a
separate operational association and must not replace invoice receivedBy.

Assigned-only commands validate actual pickup/customer ownership, permission and
branch/company context. Rejections leave no invoice, customer, piece or financial
side effects. Replay and revocation follow the command's actual authorization/
identity contract; an earlier acceptance does not justify bypassing current access.

Cash receipts apply immediately; bank receipts apply at clearance. Internal
reconciliation confirms receipt without clearing/applying the bank payment;
clearance reconciles as well. Completion must not apply a payment twice.
Registration with zero payment records no money received. Invoice receipts use
INITIAL-PAYMENT/PAYMENT workflows; other-income SALES is not a substitute.

Closeouts govern daily new-entry eligibility, not an immutable accounting-period
snapshot. Preserve original registration/journal attribution and use the actual
contract for any later completion/correction effects; do not reopen/move an old
entry day merely to make a test pass.

### Suggested action

#### API work

1. Review assigned invoice creation at `POST /invoices/sync/create-assigned`,
   its grant/assignment/customer checks and replay behavior. Do not reuse pickup-
   only results as invoice authorization proof or invent a new retry key.
2. Cover invalid/out-of-scope receivedBy and remaining actor/context variants;
   preserve verified employee/daily-route positives and server-managed attribution.
3. Verify registration/completion adapters preserve authoritative invoice/journal
   identity and totals across remaining payment methods. Keep granted permissions
   separate for internal reconciliation, clearance and invoice actions.

#### Database work

1. Seed isolated owned/foreign pickups/customers and controlled actors with valid
   branch setup. Retain before/after invoice registration, customer/piece links,
   versions, receipts, journal effects and command/replay identities.
2. Verify denied/conflicting requests leave no dependent records or financial
   effects. Inspect actual transaction/replay mechanisms before proposing schema
   changes; the passing NY identity-preservation path does not require a migration.
3. Keep historical receiver/digitizer attribution distinct. Any legacy backfill
   must preserve original IDs and audit associations and have a reviewed scope.

#### Both — API and database together

1. Establish assigned-only positive controls, then vary foreign pickup, foreign
   customer and inaccessible branch/company references one at a time. Compare
   complete persisted state after denials.
2. Exercise relevant grant/assignment revocation and supported exact replay. For
   in-flight windows, use barriers after authorization/before commit and the agreed
   ordering policy; fresh post-revocation rejection alone is insufficient.
3. Cover remaining initial-payment/completion effects, including immediate cash
   and deferred bank receipts through clearance; verify one application and correct
   financial readbacks. NY zero-payment completion is an existing regression.
4. Extend `invoice/assigned_create_integration_test.go`,
   `TestAssignedInvoiceAndPaymentTransactionsIntegration`, and
   `invoice/handler_integration_test.go`, `TestCreateInvoiceEndpointIntegration`.
   Map each actual assertion to the remaining variant, not a blanket pass.

## V14 — Reserved-number scope, cursor consistency and date boundaries

### Issue

**Partially verified; broader boundary/context cases remain.** Earlier bounded
GET pagination/sort and null/date-validation controls passed. Active NY added
17 passing device-claim controls and five passing tied-page/filter/restoration
controls using two newly generated numbers and a temporary identity.

Verified: non-null current-day receivedAt eq/neq/gte/lte, selected instant
comparisons, exact claim replay, wrong-device return rejection, timestamp clearing
and invalidated proof after return. Real createdAt ties paged across an owned
allocation change, concurrent repeats stayed stable and one number-sorted cursor
rejected a changed nonmatching filter. Both numbers were returned to the pool.

Remaining: other authorized company/actor contexts, broader filter/sort binding,
sort-key mutation consistency and actual business-midnight/DST boundaries with
non-null timestamps. Source/POST allow-lists do not establish GET cursor semantics.
The pool is company/user-based; no branch filter or branch-isolation contract is
invented simply because the tested actor belongs to NY.

### Expected result

Reserved numbers support offline mobile creation. They can be unassigned in the
company pool, assigned to a user or claimed by a device. A claimed number must be
returned from that device before reassignment. Unused reservations are excluded
from ordinary customer invoice lists and financial totals.

`receivedAt` is the nullable RFC 3339 **server timestamp of the current device
claim**, not generation/reservation time or physical invoice/merchandise receipt.
It clears when device assignment is removed; missing historical values stay
null/absent. No physical-receipt field is requested.

Date-only eq/neq compare the business day; gte starts at its beginning and lte
includes its end. Timestamp values compare instants. Missing/null values fail
eq/gte/lte and are included by neq. Invalid/impossible receivedAt/reservedAt dates
are rejected. Reviewed source uses company closeout timezone, default
America/New_York; verify actual configured and deployed midnight/DST behavior.

GET `/invoices/reserved` returns a cursor envelope:

```json
{
  "success": true,
  "data": {
    "items": [],
    "remaining": 0,
    "lowThreshold": 10,
    "nextCursor": "optional opaque cursor"
  }
}
```

`lowThreshold` is per user and zero is valid; 10 above is illustrative. POST
`/invoices/reserved/search` returns a **flat data array plus page metadata**, not
GET's data.items envelope. Keep actual metadata, totals and cursor conventions.

Queries are read-only, scoped before count/pagination, bounded and cancellable.
Supported sorts have deterministic ties. Cursor reuse/invalidation and behavior
under concurrent changes must match a documented policy; snapshot pagination or
universal rejection after every filter/sort change is not assumed. Unauthorized
contexts must never disclose records. Management reads must honor the documented
privacy rules for claimed proof tokens and device identifiers.

### Suggested action

#### API work

1. Publish actual GET/search fields/operators/sorts, envelopes, metadata, errors,
   scope and cursor reuse/invalidation rules. Keep GET cursor and POST page
   behavior independently tested; a record-ID cursor alone proves no context binding.
2. Exercise remaining number/date/user/status filters, AND/OR and negated multi-
   leaf status predicates, search-bar intersection and mixed expressions according
   to documented grouping/join behavior. Reject unsupported input explicitly.
3. Preserve separate pool-view/generate/assign and invoice/device command grants.
   GET/search requires canViewInvoicePool; do not infer command rights from view.
   `POST /invoices/reserved/actions` uses its actual action DTO and replay rules.
4. Confirm any intended branch restriction and concurrency policy with the
   modeler before treating unspecified behavior as a defect or inventing fields.

#### Database work

1. Prepare isolated multi-company/actor fixtures, enough records for page-spanning
   ties, and non-null device claims just before/at/after business midnight and DST.
   Use controlled fixtures rather than altering timestamps on existing records.
2. Inspect date comparisons, scope/count/pagination queries and actual indexes/
   tie-breakers. Add storage/index changes only for demonstrated requirements;
   query-plan/capacity acceptance belongs with I07.
3. Verify claim/return commands preserve receivedAt lifecycle, ownership/proof
   versions and atomic audit/replay state. Prior claim/return controls are verified
   regressions, not a request to migrate all older null timestamps.

#### Both — API and database together

1. Traverse supported GET sorts and POST pages against expected fixture IDs;
   verify complete coverage, deterministic ties, totals and changed authorized
   contexts without leakage. Use the actual scope contract, not an invented branch parameter.
2. Exercise sort-key mutations and claim/return changes while paging. Establish
   expected consistency first, then record omissions/duplicates/restart behavior;
   selected allocation-change tests do not certify every mutation race.
3. Check non-null timestamps around business midnight/DST, offsets and instants;
   retain current-day/null/invalid-date controls as regressions. Derive expected
   membership from fixtures, not another API page or browser timezone.
4. Extend `invoice/reserved_integration_test.go`,
   `TestReservedInvoicePoolTransactionsIntegration`, and
   `invoice/reserved_search_test.go`. Route publication to B05, representative
   plans/load to I07 and low-pool notification delivery to I08; those IDs are
   not closed by V14. No whole-directory download is an acceptable workaround.

## API context, execution and completion evidence

Relevant reviewed routes include PUT/GET `/customers/{id}`;
POST `/invoices`; PUT/GET/DELETE `/invoices/{id}`; assigned sync creation;
GET `/invoices/reserved`; POST `/invoices/reserved/search`; and
POST `/invoices/reserved/actions`. Update/delete actions use their actual
mutation-version contract. Use current DTO/version/retry fields rather than
invented interchangeable workflows or parameters.

HTTP acceptance requires a Firebase JWT in Authorization: Bearer and an
authorized x-company-id, with real resource/action permissions and company/
branch/assignment scope. Hidden controls and direct service tests do not prove
HTTP enforcement. Use approved isolated fixtures; never weaken validation or
change retained data merely to manufacture a test. Redact proof tokens,
credentials and personal data in returned reports.

Reviewed Go/Mongo fixtures require a disposable loopback replica set with
`APP_ENV=codex`, `RUN_INTEGRATION_TESTS=true`, `DATABASE_NAME=emsys_codex_test`.
Delivery workflow uses `EMSYS_WIZARD_MONGO_URI`; assigned invoices/pool use
`EMSYS_INVOICE_SYNC_TEST_URI`; customer deletion history uses
`EMSYS_CUSTOMER_DELETE_TEST_URI`. Inspect each suite's current guards/cleanup,
run families serially and report skipped tests. These backend suites were not
executed in the portal review environment.

Return one Markdown report per ID containing source/deployed revision,
environment/date, exact fixture/actor grants and scope, sanitized request/version/
retry fields and responses, expected/actual outcome per variant, persisted
before/after records/amounts/history, rejection/rollback/replay/concurrency results,
and executed/skipped/blocked cases. Include relevant evidence directly rather
than inaccessible portal links. Distinguish verified controls, source presence,
implementation, deployed acceptance and publication. Keep unverified variants
open and return unresolved deletion, identity, replay-after-revocation or cursor
policy decisions to the modeler before implementing assumptions.
