# Backend gap source review — November 13, 2026

Read-only review of `.reference/emsys-api` at commit
`675da5320b9ea6901b1223088579cd74a4d759e3`
(`Merge pull request #371 from embarques/fix/financial-directory-contract-followups`).
This records source findings alongside the [remaining gap index](backend-api-gaps.md).
No gap is removed or marked resolved. The API checkout is ignored by the portal
repository; the relative source links below require that local checkout.

No API process, binary, tests, seeding, migration or live requests were run.
Source behavior and checked-in Swagger do not establish deployment, persisted
production state, Scalar conversion parity or successful acceptance tests.

## B15: expense classification trusts supplied metadata

The reviewed posting path explains the saved forged-category result:

- [Journal posting](../.reference/emsys-api/internal/journal/service.go)
  calls `resolveJournalFunding`, then `ValidatePostingAccounts`, then the posting
  engine. Ordinary create and synchronized create reach the shared posting path.
- [Funding resolution](../.reference/emsys-api/internal/journal/funding_repository.go)
  resolves `SourceAccount` for EXPENSE; it does not canonicalize the expense
  classification in `Account`.
- [Posting-account validation](../.reference/emsys-api/internal/journal/clearance_repository.go)
  rejects a matching `nonPosting: true` account. It does not require every
  supplied classification ID to exist, be active or have the expected type.
- [`buildExpense` and `requireAccount`](../.reference/emsys-api/internal/journal/posting_engine.go)
  require a nonempty classification name and build the debit from the supplied
  reference. They do not resolve its persisted classification.

Keep B15 open. A backend correction must canonicalize the category within the
tenant before posting and cover create, sync, update and correction paths.
Use the existing saved genuine-EXPENSE positive control and forged-ASSET negative
control, plus missing, inactive, non-posting and foreign references. Verify
unchanged balances, journals and retry receipts on rejection. This review did
not execute those controls or certify all entry paths.

## B16: branch defaults and logistics-owned status need decisions

Two source paths explain why the previous fixture can have no status without
establishing a response-projection defect:

1. [`createDetailBarcodes` / `defaultBarcodeStatus`](../.reference/emsys-api/internal/invoice/repository.go)
   read `branch.settings.defaultLabelStatus`. Missing settings or zero returns
   nil; there is no unconditional ALM-NY fallback. A configured missing catalog
   status produces an ID-only snapshot. New labels receive this snapshot.
2. [`applyEmbeddedBarcodeLogistics`](../.reference/emsys-api/internal/invoice/barcode_ownership.go)
   declares arbitrary status server-owned. CONDUCE is applied only when an owned
   piece patch supplies both `delivery` and status ID 6, and passes delivery
   assignment validation. A status-only patch does not enter that branch.
   A daily `route` reference is not the required numeric `delivery` reference.

Keep both observed failures and B16 open. Inspect the actual fixture branch
settings before attributing the missing default to persistence or projection.
The source supports a narrower logistics command than the earlier status-only
probe; it does not justify silently accepting unsupported status input.

User clarification: CONDUCE is a barcode status that usually indicates assignment
to a daily route for delivery. Changing status and assigning a daily route are
separate actions; a CONDUCE status does not itself require a daily route.
The user's subsequent preferred behavior is directional: assigning an item to a
daily delivery route should also set its barcode status to CONDUCE. This does
not make status edits assign a route or define what route removal does to status.

The current [portal assignment flow](../src/lib/labels/api/barcodes-api.ts)
(`assignBarcodesToDailyRoute`, including `assignCatalogBarcodeRoute`) preserves
the existing status while setting `route`; it does not automatically select
CONDUCE. The API's `AssignInvoiceItemBarcodesRoute` and
`AssignCatalogBarcodesRoute` likewise set route/trip/audit fields without setting
CONDUCE. `ResolveDailyRoute` validates the daily route, while
[`ResolveDeliveryAssignment`](../.reference/emsys-api/internal/barcode/repository.go)
resolves a separate numeric delivery belonging to the piece's container.
The reviewed assignment paths do not yet provide the preferred automatic CONDUCE
update. Recommended owner: the API, setting route, CONDUCE status, trip metadata
and audit evidence in the same transaction across catalog and embedded copies.
Apply the agreed behavior consistently to bulk, catalog and embedded assignment
entry points, retaining permissions and delivered-piece locks. A portal-only
second status request can partially fail and would not cover other clients;
it is not implemented as a workaround here. The API clone remains read-only.

Acceptance must cover successful assignment/readback of both copies, invalid
assignment leaving route and status unchanged, and delivered-piece rejection.
User clarification: returned pieces normally become DEV-RD. Recommended action:
an explicit Return/unassign command clears current daily-route/delivery membership
and sets DEV-RD (fixed catalog ID 5) atomically in catalog and embedded copies.
The existing catalog lists CONDUCE as DEV-RD's predecessor. This replaces the
earlier proposal to restore an arbitrary recorded prior status. Preserve shipping
container and assignment history; delivered pieces retain their existing locks.
For direct reassignment, recommend moving membership and keeping CONDUCE without
an intermediate returned state. Generic standalone status edits remain separate;
this does not silently make every DEV-RD edit execute an unassignment command.
Same-route retries after a separate status edit and eligibility of other lifecycle
states still need an explicit contract. These behaviors are not implemented or verified.
The embedded status-write restriction involving a separate numeric delivery
reference remains a contract question: the user's clarification does not explain
or approve that restriction. Keep the observed silently ignored status write
under B16 open pending agreement on the supported status-edit path.

User requirement: every branch must have an explicitly configured default label
status from its applicable catalog. The base catalog is fixed across companies,
with additional pre-CONDUCE steps allowed; no default is inferred from that base
catalog, ID 1 or a first workflow step. This supersedes the earlier fallback suggestion.
When piece generation encounters a missing default:

- An administrator must be prompted to configure it in **Branches → edit the
  relevant branch → Settings → Default label status** (`/branches`). Offer
  catalog-backed choices rather than asking the user to guess a numeric ID.
- Other users must be told to contact an administrator, with the affected branch
  and the same configuration location. They must not be allowed to set it through
  the generation prompt or by bypassing the UI.
- Preserve the user's draft while configuration is missing; require a valid
  saved default before generation proceeds. Do not silently create statusless
  pieces or automatically submit a mutation that may already have succeeded.

Current implementation does not establish this requirement. The existing
[branch form](../src/components/branches/branch-form.tsx) uses a numeric input.
[`createEmptyBranchSettings`](../src/lib/branches/types.ts) defaults to ID 1 and
[`normalizeBranchSettings`](../src/lib/branches/api/branches-api.ts) uses that
default for missing values, potentially masking missing backend configuration.
Future alignment must preserve the missing/configured distinction.

Only administrators may define the default, enforced by the API as well as the
portal. The reviewed [branch routes](../.reference/emsys-api/internal/branch/routes.go)
gate updates with branch-update permission; this alone does not establish an
administrator-only field restriction. The authoritative administrator capability
and field-level enforcement must be aligned with the backend authorization
contract, without inferring admin rights from frontend role-name comparisons or
from general branch-update access. This restriction does not imply that all
other branch settings must become administrator-only.

Acceptance includes missing, zero, invalid/deleted and valid catalog references;
administrator versus non-administrator access (including direct API requests);
draft preservation; and generation resuming only after valid configuration is
saved. No configuration UI, permission or generation behavior was changed here.

After agreement, verify configured and unconfigured branches, valid delivery
assignment, invalid transitions, catalog/embed synchronization and delivered locks.
Do not infer a delivery identity from a similarly named daily route.

## V06: numeric embedded identity can be ambiguous across containers

The endpoint has an implementation and a documented identity; there is still a
modeling issue requiring agreement:

- [`createDetailBarcodes`](../.reference/emsys-api/internal/invoice/repository.go)
  assigns numeric embedded IDs from the container's barcode sequence. Each piece
  also gets a stable ObjectID `barcodeId`. Catalog upsert assigns a separate
  numeric catalog ID, while retaining `barcodeId` as a correspondence key.
- `FindInvoiceItemBarcodes` queries invoice details using only
  `barcodes._id in ids` before owner validation. It has no request container
  scope. It rejects repeated numeric IDs in the returned rows and rejects owners
  in another branch. Container-local numeric IDs can therefore match unrelated
  pieces, even when the requested piece's own branch/container is valid.
- The same repository checks owner/container consistency and tenant container
  existence/company metadata. A saved eligibility 400 alone does not identify
  which check failed; numeric collision is a source-derived explanation to test.
- [`AssignBarcodesRoute`](../.reference/emsys-api/internal/invoice/service.go)
  validates 1–200 distinct positive IDs, wraps the operation in a transaction,
  locks route/invoice logistics, updates both copies and allocates trips.
  Repeating a successful command can allocate a new trip.

User-selected target: use the full printed barcode (`number`) as the immutable,
company-unique piece identifier, and propose retiring embedded numeric piece IDs
and `barcodeId` from business/API identity after migration. This supersedes the
earlier ObjectID-versus-container-scoped-ID question. No identifiers are removed
in this review. Keep V06 open, including the existing missing-ID error and
lookup-timeout evidence, until the new contract and its compatibility rollout
are implemented and verified.

Terminology clarification requested by the user: the repeating number is the
embedded piece's numeric `id` (stored as `_id`), taken from its container's
`barcodeSequence`. For example, two different containers can each have piece
`id: 1`. The full printable `number` includes branch/container prefixes plus
the sequence; it is not just that integer. The stable ObjectID `barcodeId` and
the separately allocated catalog numeric `id` are other identifiers. This
finding does not mean complete printed barcode strings restart identically.

### Printed barcode as the canonical piece identifier

The source does not yet fully enforce the requested invariant:

- The tenant [seed indexes](../.reference/emsys-api/internal/seed/indexes.go)
  define `idx_barcodes_number` with `ascendingIndex`, not `uniqueIndex`.
  This is an ordinary lookup index, not a company-wide uniqueness constraint.
  Actual deployed indexes and historical duplicates were not inspected.
- [Barcode update](../.reference/emsys-api/internal/barcode/service.go) preserves
  `Number` for invoice-owned pieces, but `mergeBarcodeUpdate` accepts a supplied
  nonempty number for other catalog pieces. Global immutability is not
  established by that partial protection.
- Generation currently builds the printed string from branch/container prefixes
  and a container sequence. Atomic sequence allocation within one container does
  not by itself enforce uniqueness across the whole company or all write paths.

Current responsibilities of the additional identifiers:

| Identifier / use | Source evidence | Can printed barcode replace it? |
| --- | --- | --- |
| Embedded numeric `id`: bulk assignment and legacy delivery selection | [Assignment repository](../.reference/emsys-api/internal/invoice/repository.go), [completion selectors](../.reference/emsys-api/internal/delivery/completion_repository.go) | Yes, with string-based selectors and updated payloads; sequence can remain generation metadata rather than identity. |
| Catalog numeric `id`: GET/PUT/DELETE routes and default list ordering | [Barcode routes](../.reference/emsys-api/internal/barcode/routes.go), [service](../.reference/emsys-api/internal/barcode/service.go) | Yes at the API boundary; route parsing, clients, sort ties and query keys must migrate. Database storage keys are a separate implementation choice. |
| ObjectID `barcodeId`: links catalog and invoice-embedded copies, owns removal targets | [Catalog synchronization](../.reference/emsys-api/internal/barcode/repository.go), [invoice ownership/removal](../.reference/emsys-api/internal/invoice/barcode_ownership.go) | Yes, once one immutable number identifies the same piece in both copies and all writes validate ownership. |
| ObjectID `barcodeId`: delivery completion selections and persisted signed-receipt selections/replay | [Completion service](../.reference/emsys-api/internal/delivery/completion.go), [completion repository](../.reference/emsys-api/internal/delivery/completion_repository.go) | Yes for new contracts; historical signatures, receipts and retry identity must retain their original associations. |
| ObjectID/numeric IDs: print selection, portal UI identity and label removals | [Print helper](../src/lib/labels/print-label-report.ts), [invoice normalization/patches](../src/lib/invoices/api/invoices-api.ts), [removal mapping](../src/lib/invoices/barcode-sync.ts) | Yes; [report lookup](../.reference/emsys-api/internal/report/lookup.go) already permits label lookup by `number`, but all callers and selectors still need alignment. |

None of these traced responsibilities inherently requires a second public piece
identifier once the printed number has the requested guarantees. The existing
IDs provide those associations under today's contracts; deleting fields before
replacing their consumers would break working flows. A database may retain a
private storage key without exposing it as a competing business identifier.

Proposed backend/portal work, not implemented:

1. Audit tenant catalog and invoice embeds for missing, duplicate or disagreeing
   numbers. Matching copies of the same piece are expected; different pieces
   sharing a number need explicit adjudication. Do not silently renumber printed
   labels, merge pieces or rewrite signed/history evidence.
2. Retain the existing increasing sequence for barcode allocation. **Backend
   clarification November 16:** deletion leaves the counter unchanged; future
   allocations move forward and deleted numbers stay retired. The reservation-table
   proposal is withdrawn. Remaining checks are that imports/reseeds preserve the
   counter, including deleted high numbers, and concurrent allocations advance it
   atomically. Reprinting/retrying the same piece retains its identity. This
   clarification is not new runtime evidence. The separate uniqueness review must
   still cover catalog and embedded pieces across write paths.
3. Make the number immutable after creation across all write paths. Moving a piece
   between containers/branches, changing prefixes, editing descriptions and
   reprinting must retain its original number. Keep barcode values as strings to
   preserve prefixes and leading zeros; the user has not requested a new format.
4. Migrate assignment, catalog routes, embedded edits/removals, delivery review
   and completion, printing, UI keys, search/cursor ties and cache keys to scoped
   barcode strings. Preserve API authorization and company scoping everywhere.
5. Maintain legacy-ID-to-number compatibility for existing clients and historical
   references during rollout. Define how old request receipts and payload hashes
   are honored before retiring the old fields. Only remove redundant business
   IDs after consumer migration and focused compatibility/atomicity tests.

No production-data inspection, duplicate cleanup, index changes, identity
migration or API implementation occurred. This is a documented proposal for the
user's requested identity model, not a claim that it is already deployed.

## B12 / F04: loan command exists, with additional replay semantics to settle

The clone contains a [loan increase contract](../.reference/emsys-api/docs/contracts/loan-principal-increases.md),
[request/service](../.reference/emsys-api/internal/loan/increase.go),
[permission registration](../.reference/emsys-api/internal/loan/routes.go) and
[integration test source](../.reference/emsys-api/internal/loan/increase_integration_test.go).
These tests were read as source and were not run.

The command requires journal-create permission, a UUID `requestId`, matching
employee/user branch and a persisted source account. It hashes the marshaled
request and binds saved identity to actor and loan. Loan principal, transaction
and journal writes share a transaction. A matching replay returns the saved
transaction/journal with the current loan.

The service checks an existing receipt **before** checking active-loan status
and before posting through the current-closeout path. The contract document's
blanket inactive-loan/missing-closeout 409 wording therefore needs clarification
for retries after a successful commit. Preserve the frozen payload, including
optional fields and reference metadata, on retry; the digest covers the request.
Do not choose replay policy or enable the gated portal action from source alone.

[`prepareLeaf`](../.reference/emsys-api/internal/chart_account/service.go) also
explains the account-setup prerequisite: a new LOAN leaf follows a permitted
layer-3 parent with an explicit four-digit code in its range; `1300-1399` maps to
LOAN. This differs from BANK's automatic code allocation. Verify tenant parent,
available code and branch eligibility before interpreting a fixture 400 as a
broken loan-account implementation. No account was created in this review.

At the time of this review, the [portal increase adapter](../src/lib/accounting/loans/api.ts)
omitted `requestId` and its comments called the command unavailable. Subsequent
[local portal alignment](backend-gap-local-handoff-2026-11-13.md#portal-loan-increase-adapter)
adds scoped stable UUID retries and corrects those comments. The feature gate
and valid deployed lifecycle acceptance remain open; API source is unchanged.

## B05 / B09: source publication differs from saved deployed evidence

The clone's [generated Swagger](../.reference/emsys-api/docs/swagger.json) includes:

| Surface | Present in this checkout |
| --- | --- |
| `GET /vehicle-routes/business-date` | Branch parameter, business timezone/date and assigned-only access description |
| `POST /invoices/reserved/search` | Flat envelope, receivedAt semantics, allow-lists, pagination and deterministic tie description |
| `POST /change-requests/search` | Allow-lists, queue scope, grants and null-review semantics |
| `POST /loans/{id}/increases` | Required UUID schema, permission, branch scope, replay and atomicity description |
| `POST /journals/clear` | Explicit clearance grant and atomic clearance/reconciliation description |
| `POST /journals/reconcile` and `journal.Journal` | Bank exclusion and NOT_REQUIRED enum |
| Bulk barcode route assignment | Embedded numeric identity, 1–200/unique array constraints and replay warning |

This is evidence of checked-in publication work, not a replacement for the
November 13 saved deployed-schema failures. Compare served Swagger, converted
Scalar and the portal's checked-in schema before changing B05's status. Full
nullable embedded-route schema parity was not certified in this pass.

A subsequent [read-only publication audit](backend-gap-publication-audit-2026-11-13.json)
confirms the portal snapshot still matches the public Scalar specification;
publication is stale relative to the newer clone. It also identifies two explicit
source-schema omissions: `core.Barcode.route` nullability in the single embedded
piece form, and positive uint32 item bounds for bulk `barcodeIds`. Source's
nullable `barcode.Barcode.route` and bounded array alone do not cover those
declarations. No portal schema or API source was manually changed to mask them.

B09 remains a support decision per field. For example, the clone's
[vehicle model](../.reference/emsys-api/internal/vehicle/model.go) exposes
`inspectionDate` and `registrationDate` but excludes both from
`AllowedQueryFields`. A response field is not automatically searchable.
The subsequent static [53-candidate comparison](backend-gap-search-source-review-2026-11-13.json)
checks every B09 filter/sort candidate against its explicit Go allow-list. All
53 requested names are absent. This is source comparison, not a rerun of the
saved runtime matrix, operator tests, alias validation or query-plan measurement.

### Search changes need different kinds of implementation

The subsequent [per-table search/filter/sort definition](table-search-contracts.md)
provides independent proposed sets for 51 table surfaces/resource groups, with
an [exact source comparison](table-search-contracts-2026-11-13.json). Street
address and city remain in the main operational search bars by user decision.
This is a reviewable contract proposal, not a runtime change or closure of B09.

Do not treat every candidate as adding a string to an allow-list:

- **Existing stored fields:** branch address/settings/disclaimer, container
  sequences, customer notes/receivers, employee loanBalanceUpdated and vehicle
  due dates have model fields but lack the requested allow-list entries.
  Recommend deliberate field/operator/index support where useful; validate
  date-only due-date semantics and array matching rather than using generic text
  comparisons. Support remains pending, not newly approved for all candidates.
- **Potential wire-name mappings:** inventory supplier stores and allows
  `companyName`, not `name`. Container has `name` and `containerNumber`, not a
  generic `number` field. Confirm the table column's business meaning before
  mapping either candidate; these are not interchangeable by name alone.
- **Missing name projection:** inventory `postedBy` is a stored string actor
  reference, not `{name: ...}`; receipts/dispatches store supplier/holder IDs.
  Human-name search requires an agreed current-name or historical-snapshot
  contract and a server query/projection, not `postedBy.name` on the current
  document or per-row portal lookups.
- **Missing actor metadata:** the reviewed invoice-description model has
  createdAt/updatedAt but no createdBy/updatedBy fields. Creator-name filters
  require capturing actor metadata for new writes and an explicit policy for
  unknown historical actors. Do not invent historical users.
- **Collection/object fields:** invoiceDetails, customer, loan, permissions and
  crew arrays need defined leaf fields and array/group behavior. Matching a
  supervisor name must refer to that role, not any employee with the same name.
  Vehicle-route normalization currently only converts numeric container IDs;
  it does not map driver/supervisor/helpers names to the stored employees array.

Source references: [inventory models](../.reference/emsys-api/internal/inventory/model.go),
[inventory allow-lists](../.reference/emsys-api/internal/inventory/service.go),
[invoice-description model](../.reference/emsys-api/internal/invoice_description/model.go),
[container model](../.reference/emsys-api/internal/container/model.go),
[vehicle-route model](../.reference/emsys-api/internal/vehicle_route/model.go) and
[normalization](../.reference/emsys-api/internal/vehicle_route/service.go).

## Business decisions confirmed after source review

These settle design questions; implementation and acceptance remain open.

| Area | Source finding | User decision / suggested changes |
| --- | --- | --- |
| V11: route versus delivery manifest | Route-only pieces may appear in assigned-barcodes, but completion/review/signatures still resolve a numeric delivery belonging to the invoice's container. | One shared delivery/trip may contain pieces from multiple shipping containers. Keep each piece's shipping container as provenance. Assign a delivery/trip with daily-route assignment; clear/replace that delivery assignment on unassignment/reassignment. Single-container completion restrictions need redesign. |
| B16/V07: catalog status meaning | Pending/delivered behavior relies on IDs 6/7 in listing, review and completion; current catalog names can change. | The base catalog is fixed across companies, including CONDUCE ID 6 and ENTREGADO ID 7. Users may add steps before CONDUCE. Retain fixed core identities; support custom pre-CONDUCE steps without replacing core IDs or assuming their numeric order defines workflow order. |
| B05/V14: reserved receivedAt | Reservation transition writes receivedAt when deviceId is set and unsets it when no device is assigned. It is the current device claim timestamp in source. | Confirmed meaning: the device received the reserved invoice number. Do not repurpose it for physical invoice/merchandise receipt. Existing source semantics align; timezone/boundary/isolation verification remains open. |

Source references: [assigned listing](../.reference/emsys-api/internal/delivery/assigned_barcodes.go),
[review/status resolution](../.reference/emsys-api/internal/delivery/review.go),
[delivery completion contract](../.reference/emsys-api/docs/contracts/delivery-completion-wizard.md),
[reservation transitions](../.reference/emsys-api/internal/invoice/reserved_repository.go)
and [reserved search contract](../.reference/emsys-api/internal/invoice/reserved_search.go).

### Delivery/trip modeling impact

The [current delivery model](../.reference/emsys-api/internal/delivery/model.go)
contains one container, and [creation](../.reference/emsys-api/internal/delivery/service.go)
requires it to allocate a per-container sequence and a name such as
`1-<container name>`. The user describes the container association as primarily a
naming convention, not a restriction on what the outing can carry. The confirmed
shared-trip requirement supersedes per-container trip grouping as a target model.

Confirmed boundary: the daily delivery route is the trip. It is not a parent of
separately selected open trips. Additional piece assignments to that route join
the same outing; they do not allocate another trip per batch or per container.
Source containers remain on the invoice/pieces. A display label may
retain a container-derived naming convention, but it must not constrain member
pieces to that container or act as delivery identity. Assignment must update
daily route, shared delivery/trip, CONDUCE and both piece copies atomically.
Return/unassignment clears current route and delivery/trip membership and sets
DEV-RD without clearing the original shipping container. Recommend direct
reassignment replace current membership and retain CONDUCE in one transaction.
Old assignment history and signed completion receipts remain historical evidence.

Affected source surfaces include numeric delivery resolution, review, completion,
standalone receiver signatures, assigned listing, trip allocation and reporting.
For example, completion explicitly compares invoice.container with
delivery.container; that check cannot express the agreed mixed-container trip.
Replace it with authoritative membership validation rather than merely removing
scope checks. Preserve invoice-specific balances, policy/photo ownership and
receipt boundaries when several invoices share a trip. A shared trip does not
authorize one receiver to sign for unrelated invoices.

The portal's delivery schedule lookups also require containerId and group by it
in [route hooks](../src/lib/pickup-delivery-routes/hooks/use-pickup-delivery-routes.ts)
and the [route API adapter](../src/lib/pickup-delivery-routes/api/pickup-delivery-routes-api.ts).
These consumers need alignment with shared trip membership; backend changes
alone would not complete the user flow. No separate open-trip picker or
start-new-trip action beneath a daily route is requested. A legacy delivery
record, if retained for compatibility, must resolve to the same route/trip
without forcing another user selection or per-batch allocation. Existing numeric
delivery IDs and historical trip numbers still need an explicit mapping/migration;
do not substitute route ObjectIDs into numeric delivery endpoints. No endpoint
or payload for that target model is invented here.

### Extending the fixed status catalog

The reviewed barcode routes expose status options but no status-catalog write
operation. Custom pre-CONDUCE steps therefore require an agreed management
surface and permission, not just a different branch default. The current
[status seed](../.reference/emsys-api/internal/seed/barcode_statuses.go) rewrites
core names and prevStatus, including CONDUCE's predecessor list. A future
extension must preserve configured custom transitions across reseeding, reserve
core IDs, and use explicit ordering/transition rules instead of renumbering
CONDUCE/ENTREGADO or comparing display names. Default-status configuration
remains administrator-only as previously agreed. Users with a dedicated workflow
configuration permission may add/change additional pre-CONDUCE steps; this is
not administrator-only. The backend must define and enforce that capability,
seed it deliberately and publish it before the portal enables controls. Its
grant does not authorize changing protected core states or branch defaults.
No permission wire name or endpoint is assumed from this business decision.

Loan retry policy selected with the user's authorization to follow the
recommendation: preserve access checks, and let an authorized exact retry
retrieve its already committed result after closeout closure or subsequent
loan-state changes, without posting new effects. Bind it to the same tenant,
loan, actor, UUID and frozen payload. A changed payload conflicts; denied current
access remains denied. A new request must pass current loan/account/closeout
eligibility. The reviewed service already looks up its receipt before the
active-loan/current-closeout path; the contract wording should distinguish replay
from a new increase. Retain its documented current-loan response alongside the
original transaction/journal; do not claim the loan snapshot is frozen.
Lifecycle/replay/concurrency tests and F04 stable identity remain required before
resolving B12/F04; no financial semantics or portal gate changed.

## Remaining verification and validation

V02–V15 and I01–I08 retain their existing status. Transaction wrappers, test
files and contract descriptions cannot certify injected rollback, commit-window
authorization, historical migration, cross-tenant isolation or query capacity.
No backend formatting or test commands were run, preserving the user's read-only
instruction. Only portal documentation was added; no application behavior changed.
