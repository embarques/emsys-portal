# Backend/API verification — November 6, 2026 (archive)

Historical verification snapshot, including completed checks and retained mock
records. This is not the current work list; use the [pending tracker](../backend-api-gaps.md).

Single index of every backend/API TODO the portal depends on. Each linked
document keeps the detailed contract; this page records what is live.

Full verification **November 3, 2026** against `https://api.embarqueros.com/v1`
(company `64d5c0b0d1eab2aaf30b1819`, mock data) with an Administrador token:

```sh
EMSYS_TOKEN='<jwt>' npm run test:api:backend-gaps -- --bearer            # read-only
EMSYS_TOKEN='<jwt>' npm run test:api:backend-gaps -- --bearer --writes   # + journal write probes
```

By default the script is read-only: besides GET/search requests it only sends
requests the API must reject (all-zero IDs, empty payloads, missing `If-Match`).
`--writes` posts $1-scale journals tagged `ZZ_GAP_PROBE` in today's open
closeout and reverses each one; use it only where data may be changed.
Delivery, closeout and inventory write checks below were run manually.

## Latest verification — November 6, 2026

Read-only and explicitly authorized mutation tests against the same mock company,
branch 1, confirm most announced fixes. This section and the current status/open
work tables supersede the November 3–5 findings preserved below. Later same-day
follow-ups also supersede the first pass's narrower verification limits.

| Release claim | November 6 evidence |
| --- | --- |
| Permission seeds | `canListJournal`, `canReconcileJournal`, `canReconcileInventoryDispatch`, `canConfirmInventoryWarehouse`, `canConfirmInventoryCustodian` and `canCreateAssignedInvoice` are present in the catalog. Both reconciliation grants are assigned to Administrador. The current admin successfully rejected the new receipt; denied-user enforcement was not retested. |
| BANK umbrella | System BANK **4000000004** exists; Wells Fargo, TD Bank and M&T Bank reference it as parent. Deletion/type protection, hierarchy cycles and report roll-ups remain unverified. |
| Chosen cash account | **Valid selection still unverified.** The chart has only orphan ASSET `Cash Account` (id 4), with no parent; exact `CASH ON HAND` search is empty. PAYMENT/SALES create and sync correctly reject that orphan and EXPENSE selections with `422`. Explicit legacy `{id:1,name:"CASH ON HAND",type:"ASSET"}` also returns `422`; custom chart id 1 is Wells Fargo. No valid nested cash fixture was available. Successful selected-account posting/readback, update and INITIAL-PAYMENT selection are not certified. |
| Expense funding | Create/sync reject CASH with BANK, ZELLE with ASSET, WIRE with EXPENSE, nonexistent BANK and ASSET spoofed as BANK with `422`. Missing non-cash source returns `400 Source account is required`. Six non-cash methods successfully credit the selected BANK and return `sourceAccount`; positive nested-cash and real tenant/branch/inactive-account cases remain unverified. |
| Check numbers | Missing/blank explicit numbers reject create/sync with `422 CHECK_NUMBER_REQUIRED`, including external-reference-only requests. `0012345` survives GET with leading zeros. Six updates switching expenses to CHECK without a number also return `422`. |
| Debit card / Wire | Both are in the catalog. PAYMENT create/sync and SALES create accept them with BANK `paymentAccount`; expenses return BANK `sourceAccount` and OUTSTANDING clearance. Invoice payments defer application until `/journals/clear`; sync and clearance replay are idempotent in the tested cases. SALES description updates succeed. **Uncleared PAYMENT edit/reversal fails**, reproduced below. |
| Initial-payment reference | New create/sync registrations **INV-26-001482 / INV-26-001483** return `refNumber` equal to the allocated invoice number. Sync replay preserves journal ID and reference. The gap script's old `TXN-…` samples predate deployment and do not establish a current defaulting defect. |
| Duplicate conflict | Repeated CASH payment returns `409`, `data.code: DUPLICATE_PAYMENT`, message `Duplicate payment warning`. |
| Reversal-aware totals | Six new expense original/reversal pairs each total income/expenses/net zero. All new reversible probe groups also net to zero; the prior 44-record expense audit now nets to zero. |
| Receipt linkage | Journal **6aee112fd037620215133a71** returns `inventoryReceiptId: 25650aff-77c8-4aee-9c7b-a67f2bc51252` on create/GET; receipt GET resolves the matching item, supplier, warehouse, quantity and cost. |
| Empty-warehouse dispatch | Complete dispatched INVENTORY request returns `422 INVALID_INVENTORY_REGISTRATION`, replacing the prior `500` in this scenario. The response does not identify insufficient stock specifically, so the internal failure cause is not certified. Warehouse stock remains unchanged. |
| Swagger / Scalar / DELETE | Published Swagger now has 297 paths and documents the previously missing routes. Both `/swagger/doc.json` and `/scalar/openapi.json` deprecate journal DELETE, describe immutable posted history and document `409`. Four disposable posted journals returned `409` on DELETE and remained readable. The local `api-docs.json` was not refreshed by this verification. |

### Remaining defect: uncleared invoice-payment edit/reversal

On invoice **475917** (`6a322b4ca08ce327600a00b8`), starting cost/balance $120
and payment $0, both DEBIT-CARD and WIRE reproduce:

1. Create a $0.03 PAYMENT with BANK `paymentAccount`: `201`, clearance
   OUTSTANDING, invoice payment still $0.
2. GET returns a fresh version and `allowedActions` permitting edit/reverse.
3. PUT the same amount/method/account with a changed description and fresh
   `expectedVersion`: **409 `Invoice balance cannot be negative`**. Supplying
   the full invoice cost/balance snapshot does not resolve it.
4. POST reverse with fresh `expectedVersion`: the same **409**.
5. Clear the test payment, then reverse: both succeed and restore invoice totals.

Affected journals **6aee1163d037620215133a76** (DEBIT-CARD) and
**6aee1164d037620215133a78** (WIRE) are now REVERSED. Successful posting and
clearance do not establish a correct pre-clear edit/reversal lifecycle.

Validation: **65 focused frontend unit tests passed**. Live probes cover the
matrix above; local tests use mocks and do not independently certify backend
behavior. The broad read-only gap suite reported 34 DONE, 2 MISSING, 1 PARTIAL,
13 UNVERIFIED; its historical initial-reference result is superseded by the
new-registration probes. Legacy status backfill remains open: **24,125 PAYMENT**
rows versus **3** classified OUTSTANDING/RECONCILED. No performance improvement
is claimed. November 6 cleanup and retained records are recorded below.

### Remaining-issue follow-up — November 6, 2026

A second authorized mock-company run rechecked the open items after the release
matrix above. These results supersede its narrower inventory and pool limits:

| Item | Follow-up result |
| --- | --- |
| Uncleared invoice-payment edit/reversal | **Still failing.** Fresh $0.02 DEBIT-CARD and WIRE entries reproduce both `409 Invoice balance cannot be negative` failures. Journals `6aee1318d037620215133a90` / `6aee1319d037620215133a92` were cleared only for cleanup, then reversed. Invoice 475917 remains cost $120, payment $0, balance $120. |
| Cash hierarchy / BANK child creation | **Still blocked.** No persisted selectable CASH ON HAND hierarchy appeared. Three tagged BANK creates under the BANK umbrella, Wells Fargo and an EXPENSE control all return `400 chart account type and display name are required`, although both fields were supplied using the documented schema. No account was created; parent validation, cycles and report roll-ups are not established by this generic error. |
| Reconciliation-status backfill | **Still incomplete:** 24,130 PAYMENT rows, 3 matching OUTSTANDING, 0 RECONCILED at the start of the follow-up, before its two new payments. |
| Receipt confirmation | **Verified:** posting leaves stock unchanged; warehouse confirmation posts two one-cent units; replaying the identical confirmation key returns 200 and stock stays at two, not four. |
| Positive-stock dispatch | **Verified submission/reservation:** one unit is reserved from two; warehouse confirmation alone leaves the dispatch PENDING_CONFIRMATION and does not transfer stock. Rejection releases the reservation and allows cancellation. The admin's CUSTODIAN attempt returns `403 NOT_RESPONSIBLE_PARTY`; this is not a test of `SAME_ACTOR` because the admin has no linked employee. |
| Insufficient-stock control | **Verified directly:** requesting three units with only two available via `/inventory/dispatches/{id}/post` returns `422 INSUFFICIENT_STOCK`. The failed command does not consume or reserve stock. |
| Positive-stock Daily Income journal | **Verified:** dispatched INVENTORY journal returns 201, preserves `inventoryHolders` and links `inventoryDispatchId: 669c9ab3-21e3-4a0b-8464-1d470a5a0022`. The resulting pending handoff can be rejected/cancelled; the journal was reversed. |
| Delivery completion | **Blocked before balance testing.** Isolated positive/zero invoices now have resolvable catalog barcode identities. `PUT /barcodes/193` and `/194` return 200 with status CONDUCE and delivery 10471 saved, but review of those exact invoice/delivery pairs returns `404 invoice is not assigned to this delivery`. An invoice-embedded update also returned 200 but its response retained ALM-NY and omitted delivery. No completion request was sent; zero/negative/uncleared/concurrency cases remain unverified. All temporary invoice/delivery fixtures were deleted. |
| Self invoice pool | **Seed and admin execution verified.** Catalog entry `canGenerateOwnInvoicePool` is `invoice_pool_self` with `create: true`, not the older proposed `invoice_pool` contract. Swagger documents `generate-self` without an employee-link requirement. A valid one-number request assigns to current user 73, replay returns the same reservation, and return moves it to user 0. Supplying a foreign `userId` to `generate-self` returns 400. A self-only caller and listing without pool-view permission remain unverified. |
| Documentation alignment | **Still open:** local `api-docs.json` has 242 paths versus 297 live, missing 55 paths, and still summarizes journal DELETE as successful deletion. Published Swagger/Scalar are updated; the local export was not replaced by this test run. |

**71 focused local unit tests passed**, covering inventory APIs/workflow,
pending dispatches, assigned invoices, reserved pools, delivery balance and
reconciliation permissions. They use local fixtures/mocks. At that point, the sole supplied
token belonged to an admin with all 217 grants and no linked employee; denied-user
permission checks, the restricted assigned-invoice flow, true two-user handoff,
reconciliation/payment/credit effects and `SAME_ACTOR` required suitable additional
user credentials (created for the next follow-up below). No user roles, employee links or auth settings were changed.
Write-time `CLOSEOUT_REQUIRED` was not forced by closing today's shared period.
The historical unfiltered journal memory/error probes were not repeated because
of their documented database-load risk.

### Restricted-user and two-party verification — November 6, 2026

The user explicitly authorized creating test roles and users in this company.
Created real Firebase identities plus tenant users **87** and **88**; user 87
was linked to new employee **211** and a dedicated EMPLOYEE inventory holder.
No existing user's role, employee link or Firebase account was changed.
Fixed roles were used for decisive controls; the final account state is below.

| Acceptance case | Result |
| --- | --- |
| Restricted journal list/reconcile/clear and inventory reconciliation | A custodian/read-only role without those grants receives 403 on each tested request. Warehouse receipt confirmation also returns 403; the admin confirms the same valid receipt successfully. This covers the tested grant sets, not every legacy CRUD fallback or tenant boundary. |
| Auto-reconciliation gate | With a fixed role granting journal create but no journal reconciliation, plain SALES create returns 201 and the matching `autoClear: true` request returns `403 canReconcileJournal is required to auto-reconcile`. Earlier generic 403 probes without an accepted create control do not independently certify the inventory autoReconcile gate. |
| Real two-party handoff | Admin 73 confirms WAREHOUSE, responsible user 87 confirms CUSTODIAN: dispatch becomes POSTED and transfers three units exactly once. Identical confirmation replay returns 200 without a second transfer. |
| Same actor | With a fixed role allowing both parties, user 87's warehouse confirmation succeeds; its custodian confirmation then returns **409 SAME_ACTOR**. The test claim is rejected/reset before different actors complete the actual operation. |
| Returns and paid/credit reconciliation | Different actors confirm two returned units and one sold unit. Sale revenue is two cents, payment is one cent ZELLE and credit is one cent. Confirmation creates a linked one-cent SALES journal and an OPEN one-cent obligation. A verified payment must be allocated before settlement; the unallocated attempt is correctly rejected with 422. After allocation, settlement succeeds, exact-key replay returns the same result, and history contains one settlement. Final obligation is SETTLED. |
| Reconciliation payment-method coverage | ZELLE succeeds. WIRE was rejected with `422 inventory validation failed: unknown accounting payment method`; the separate inventory payment enum still lists only CASH/CHECK/BANK_DEPOSIT/ZELLE/CREDIT_CARD. Journal Debit/Wire success does not certify inventory reconciliation method parity. |
| Self-pool-only caller | **Defect confirmed independently of role changes:** fresh user **88**, role **15**, has exactly `canGenerateOwnInvoicePool` and successfully authenticates. `generate-self` with a fresh UUID and count 1 returns **403 invoice pool permission required**. The same published action previously succeeded for the admin. Seeding/admin success therefore did not close self-service execution. No reservation was allocated by this denied test. |
| Assigned-only invoice authorization | Role **16** has `canCreateAssignedInvoice` and prerequisite reads but no `canCreateInvoice`. Ordinary `/invoices/sync/create` returns 403 naming the missing full-create grant. An isolated assigned route, two-person crew and linked appointment were prepared, but the proposed valid `/invoices/sync/create-assigned` request and assignment/receiver-negative variants all return generic `400 Invoice request is invalid`, including a positive-value request with an explicit receivedBy route discriminator. **Assigned creation/replay and assignment/receiver enforcement remain unverified** until a valid positive request or clarified contract is available. No invoice was created by these attempts. |
| User update preserves Firebase identity | **New defect:** normal `PUT /users/87` omitting `uid` returns 200, but subsequent GET omits the stored UID and the test's Firebase sign-in receives API 403. Sending the original UID back restores API access (200). The portal's ordinary update payload omits uid, so the API must preserve it on omission. Only the newly created test account was affected and repaired. |

Role-definition edits also exposed newly added grants through `/users/permissions`
before the tested action accepted them. Fresh fixed roles and explicit user-role
associations preserving UID were used to remove that ambiguity. Exact permission
cache/refresh semantics remain unverified; do not interpret a stale grant probe
as proof that the standalone capability itself was enforced.

Twelve local assertions against the captured live responses and final audit
passed. They validate the recorded outcomes, including the reproduced defects;
they are **not** a claim that all backend acceptance cases pass. No frontend
runtime code was changed for these tests.

### Historical targeted recheck — November 5, 2026

Read-only GET/search checks against the same company with an Administrador
token confirmed the then-open November 4 TODOs (superseded where noted above):

| TODO | Current evidence |
| --- | --- |
| Reconciliation grants and `canListJournal` | All three are absent from the complete 203-entry `GET /permissions` catalog and the current user's permissions. Neither reconciliation grant appears in any of the five roles. All four enforcement paths were also rechecked in the authorized mutation follow-up below. |
| Journal status backfill | PAYMENT search returns 24,116 journals; the same filter plus `OUTSTANDING` returns 3 and plus `RECONCILED` returns 0. This confirms incomplete status coverage for PAYMENT journals; other journal types were not counted. |
| BANK umbrella and reparenting | BANK search returns three accounts (Wells Fargo, TD Bank, M&T Bank), all without `parentAccount` or `systemAccount: true`. No BANK system umbrella exists in this company. |
| Swagger | The published 242-path spec still omits `/journals/reconcile`, `/journals/summary`, `/journals/{id}/reverse` and `/inventory/dispatches/{id}/reconciliations`; `journal.Journal` still omits reconciliation fields. |

BANK non-deletability, fixed type, parent validation, cycle rejection and
cash/bank report roll-ups were **not verified** by these reads. See the
authorized mutation follow-up below for enforcement results and fixture
blockers. No backend checkout was available for source review. These findings
are scoped to the checked company and deployed API, not every company's
migration state.

### Authorized mock-data mutation follow-up — November 5, 2026

The user authorized mutation probes in the same mock-data company, with cleanup
where possible and labels on retained records. Focused requests produced:

| Probe | Result |
| --- | --- |
| `POST /journals/reconcile` with empty `ids` | `403 Missing permission: canReconcileJournal` |
| Dispatch reconciliation submit with an all-zero dispatch ID | `403 Missing permission: canReconcileInventoryDispatch` |
| PAYMENT journal create, CASH, $0.01, `autoClear: true`, existing mock invoice | `403 canReconcileJournal is required to auto-reconcile`; no journal created |
| Dispatched INVENTORY journal create with `autoReconcile: true`, all-zero item ID and mock holder | `403 AUTO_RECONCILE_FORBIDDEN`; no journal created |
| Create BANK child under disposable EXPENSE parent | `409 system chart account is protected` |
| Create BANK child under existing BANK parent | Same `409`; the valid-parent control is also blocked, so the wrong-parent rejection does not establish BANK type validation |
| Create disposable top-level BANK with `systemAccount: true` | `400 chart account type and display name are required`, despite both fields being supplied; no fixture created |
| Search ASSET accounts / exact `CASH ON HAND` name | One top-level ASSET, `Cash Account` (id 4); no `CASH ON HAND` result |
| Create top-level disposable ASSET / ASSET under disposable EXPENSE | `400 chart account type and display name are required` / `409 system chart account is protected` |

Cycle/self-parent probes could not proceed because BANK and ASSET fixtures
could not be created. BANK system deletion/type protection and cash/bank report
roll-ups remain unverified; no real system account was altered. These generic
creation failures do not prove that the requested hierarchy contract is
implemented. The BANK seed/reparenting, journal status backfill and permission
seed gaps remain open.

Cleanup: the only created records were disposable EXPENSE accounts **15** and
**16**, tagged `ZZ_GAP_PROBE_20261105_1793898923748` and
`ZZ_GAP_PROBE_20261105_CYCLE_1793898976918`. Both DELETE requests returned
`200` and subsequent GETs returned `404`. No probe accounts or journals remain;
normal audit history and consumed account IDs are not rolled back.

## Where the gaps live

The November 5 payment audits below are historical; use the November 6 matrix
above for their current status. Linked feature documents may retain older findings.

**Chosen cash-account mutation recheck (November 5):** item 2 remains open.
Create and sync for PAYMENT, SALES and INITIAL-PAYMENT ignored supplied ASSET
and EXPENSE destinations, always debited CASH ON HAND, and omitted
`paymentAccount` on read. PAYMENT/SALES PUT did the same; INITIAL-PAYMENT PUT
returned lifecycle `409`. Twelve PAYMENT/SALES journals were reversed; six
new mock invoices were deleted, but their labeled INITIAL-PAYMENT journals
remain ACTIVE/Outstanding ($0.81 cash, $5.19 receivables, $6 revenue).
See the [full matrix and retained-record IDs](../payment-accounts-api-contract.md#live-mutation-verification--november-5-2026).

**Debit card / Wire mutation recheck (November 5):** item 3 is partly supported.
The catalog endpoint exists but omits both methods. PAYMENT, SALES and
INITIAL-PAYMENT create, PAYMENT sync and PAYMENT/SALES update reject them with
`400 Payment method is not supported`. EXPENSE create/update accepts both,
but marks clearance `NOT_REQUIRED`, unlike matching ZELLE/DEPOSIT expense
controls (`OUTSTANDING`). Scoped `eq`/`neq` filters and filtered currency totals
work; payment-method grouping is not part of the documented summary contract.
All 12 journals created in this method audit were reversed. See the
[method matrix, reporting limits and cleanup tags](../payment-accounts-api-contract.md#debit-card--wire-live-verification--november-5-2026).

**Expense-method mutation recheck (November 5):** item 4 is **partly live**,
superseding the earlier posting-only "done" finding. All seven methods post
expenses and appear in pending search and original-journal summaries. Wrong-type,
nonexistent and spoofed sources are accepted; omitted non-cash sources default
to CASH ON HAND. Check expenses accept external/internal references instead of
requiring an explicit check number. A reversed $0.13 expense pair still reports
net -$0.13 in the summary. All 24 expense probe journals were reversed; real
tenant/branch and active-account validation remain unverified. See the
[expense matrix and cleanup tags](../payment-accounts-api-contract.md#expense-method-live-verification--november-5-2026).

**Delivery zero-balance audit (November 5):** the portal's 17 balance tests pass,
but the quoted legacy flow is stale: current completion has no uncleared override,
Cuadre setup initializes rate 1 rather than the route rate, and non-cash payments
apply on create. Live completion enforcement could not be reverified: an existing
delivery probe was rejected by automatic approval review, and newly created
fixtures lacked resolvable numeric barcode catalog records. All three new
invoices and delivery 10469 were deleted; sequence consumption/audit history
were not rolled back. The subsequent explicitly approved probe on invoice
488970 / delivery 10464 returned the balance-gate **409** for $70 owed, with
unchanged balance and all three pending pieces preserved. Correct invoice ID:
`6a34c213a08ce327600be3ec`; the previously supplied ID belonged to invoice
480406 and was not mutated. Positive-balance enforcement is now verified; other
balance states, concurrency and override semantics remain open. See the [current behavior and recheck limits](../delivery-completion-api-contract.md#current-portal-audit--november-5-2026).

| Document | Area | Live status |
| --- | --- | --- |
| [reconciliation-permissions-api-todo.md](../reconciliation-permissions-api-todo.md) | `canReconcileJournal` / `canReconcileInventoryDispatch` seed and enforcement | **Seeded Nov 6** — restricted-user denial verified on tested reconcile requests; journal autoClear denial has an accepted create control; broader capability combinations remain open |
| [pending-transactions-update.md](../pending-transactions-update.md) | Journal reconciliation, search, summary and settlement | **Mostly live** — `canListJournal` seeded; backfill open; Debit/Wire receipts deferred until clearance |
| [payment-accounts-api-contract.md](../payment-accounts-api-contract.md) | Cash/bank umbrellas, Debit card/Wire, expenses, refNumber default | **Mostly verified Nov 6** — funding/check validation, methods/clearance, reference defaults and reversal totals pass; valid cash fixture missing; uncleared PAYMENT edit/reversal defect |
| [delivery-completion-api-contract.md](../delivery-completion-api-contract.md) | Zero-balance enforcement on completion | **Partly verified Nov 5** — positive balance rejected with 409; zero/negative/concurrency/override cases open |
| [inventory-dispatch-workflows.md](../inventory-dispatch-workflows.md) | Two-party confirmation and dispatch reconciliation | **Mostly verified Nov 6** — receipt/replay, reservation/rejection, insufficient stock, true two-user handoff, SAME_ACTOR, returns and paid/credit settlement pass; broader methods/failure cases remain open |
| [assigned-invoice-api-contract.md](../assigned-invoice-api-contract.md) | `canCreateAssignedInvoice` | **Partly verified Nov 6** — full-create sync denied; assigned positive control returns generic 400, so assignment/receiver validation remains unverified |
| [closeout-transaction-edits.md](../closeout-transaction-edits.md) | Editing journals in the current open closeout (`PUT /journals/{id}`) | **Partly verified Nov 6** — Debit/Wire SALES edits pass; uncleared PAYMENT edits fail with balance 409 |
| [transaction-triggered-closeouts.md](../transaction-triggered-closeouts.md) | `CLOSEOUT_REQUIRED` and backend-directed rollover | **Partly verified** — Nov 6 explicit USD opening succeeds; write-time `CLOSEOUT_REQUIRED` remains unverified |
| [daily-route-accountability.md](../daily-route-accountability.md) | Supervisor, daily route snapshots and joint inventory holders | **Snapshots live** for journals/invoices/newly assigned appointments; legacy coverage and ledger joint-holder contract open; positive-stock journal preserves holders/link; true two-party transfer, returns and paid/credit reconciliation now verified; arbitrary joint-holder contract remains open |
| [invoice-policies-api-todo.md](../invoice-policies-api-todo.md) | Invoice policy CRUD | **Done** |
| [predefined-routes.md](../predefined-routes.md) | Predefined route catalog and pickup filter | **Done** |
| [stale-update-protection.md](../stale-update-protection.md) | Invoice/customer `If-Match` | **Done** |
| [inventory-swagger-verification.md](../inventory-swagger-verification.md), [inventory-workflow.md](../inventory-workflow.md) | Inventory write capabilities, PUT routes | Portal-side limitations; not re-checked |
| [verification-issues.md](../verification-issues.md) | Portal test/lint follow-ups | Portal-side; not API work |

`docs/archive/` holds closed historical confirmations and is not tracked here.

## Open backend work

Ordered by what blocks shipped portal features first.

1. **Preserve Firebase UID on user update.** A normal update omitting uid
   cleared the new test user's identity binding and broke API sign-in. Preserve
   omitted identity fields; validate the portal's standard update payload and
   explicitly distinguish any supported identity-rebinding operation.
2. **Fix uncleared invoice-payment edits/reversals.** DEBIT-CARD and WIRE
   PAYMENT updates and reversals return `409 Invoice balance cannot be negative`
   while the receipt is deferred, despite eligible `allowedActions` and a fresh
   version. Reproduce and resolve the sequence above without requiring bank
   clearance merely to correct or reverse a receipt.
3. **Verify a valid chosen cash account.** Provide a persisted CASH ON HAND
   hierarchy and a valid posting child in the mock company. The available
   orphan ASSET is correctly rejected, so successful selection/readback on
   create/sync/update and INITIAL-PAYMENT remains unverified. Complete active,
   branch and company scope cases, BANK protection/cycles and report roll-ups.
   Documented BANK child creates still return a generic missing-type/name 400
   despite those fields being supplied, blocking disposable hierarchy fixtures.
4. **Finish delivery balance-gate verification.** The approved November 5
   probe rejected invoice 488970 / delivery 10464 with $70 owed (`409`),
   superseding the November 3 successful nonzero completion. Verify zero and
   negative/unavailable balances, uncleared-payment handling, concurrent invoice
   changes and override acknowledgment/audit behavior before closing the full gap.
   Resolve the isolated barcode assignment/readback mismatch above: catalog PUT
   succeeds but delivery review returns 404 before completion can be exercised.
5. **Backfill `reconciliationStatus`.** The November 6 follow-up counted
   24,130 PAYMENT rows versus 3 classified OUTSTANDING/RECONCILED. Older
   unclassified rows do not match Pending Transactions' status filter. The
   migration rule remains an open contract decision.
6. **Finish permission and assigned-invoice acceptance.** Tested restricted
   list/reconcile/clear/warehouse denials and journal autoClear enforcement now
   pass, with positive controls where noted. Verify legacy CRUD fallback
   combinations, inventory autoReconcile with an accepted create control and
   broader tenant scope. Assigned-only full-authority sync is correctly denied,
   but assigned positive/negative requests all return generic 400; establish a
   valid positive request before claiming assignment/customer enforcement.
7. **Finish inventory edge cases.** True two-user handoff/replay, SAME_ACTOR,
   returns, paid/credit reconciliation, payment allocation and settlement/replay
   now pass. Verify remaining outcomes, concurrency/failure atomicity and the
   intended Debit/Wire contract for inventory reconciliations; journal method
   support alone does not establish it.
8. **Align local and feature contract documentation.** Published Swagger and
   Scalar now include the formerly missing routes and correct journal DELETE
   behavior. The local export still lacks 55 paths (242 versus 297 live) and
   retains the old DELETE description. Refresh it and reconcile older feature-doc
   status lines; published schemas alone do not certify runtime invariants.
9. **Fix self-pool-only execution.** Fresh user 88 has exactly
   `canGenerateOwnInvoicePool` (`invoice_pool_self:create`), but the documented
   `generate-self` action returns 403. Admin execution works. Fix the restricted
   caller path, then verify own listing without pool-view permission and
   foreign-user isolation. The grant seed is present; runtime acceptance is open.

## Live API defects observed

| Request | Result |
| --- | --- |
| `PUT /v1/users/{id}` without `uid` on a new test account | **Nov 6: 200 clears UID; fresh API sign-in gets 403.** Explicit restoration of the same UID restores access. |
| `POST /v1/invoices/reserved/actions` `generate-self`, fresh self-only user 88 | **Nov 6: 403 invoice pool permission required**, despite exactly canGenerateOwnInvoicePool; admin control works |
| `POST /v1/deliveries/{id}/invoices/{invoiceId}/complete` with a nonzero balance | November 3: `200`; **superseded November 5: balance-gate `409`, unchanged invoice/pieces** |
| `PUT /v1/journals/{id}` / `POST /v1/journals/{id}/reverse` on uncleared DEBIT-CARD/WIRE PAYMENT | **Nov 6: `409 Invoice balance cannot be negative`**, despite fresh version and eligible actions; after clearance, reversal succeeds |
| `POST /v1/journals` INVENTORY dispatched with `inventoryHolders` | Historical `500`; **Nov 6 positive-stock follow-up returns 201**, preserves holders and links a dispatch. Direct above-stock dispatch post returns `422 INSUFFICIENT_STOCK`. |
| `POST /v1/chart-accounts`, tagged BANK child with documented type/displayName/parent | **Nov 6: `400 chart account type and display name are required`** under both valid BANK parents and an EXPENSE control; hierarchy fixture creation remains blocked |
| Catalog barcode PUT followed by delivery review on new test fixtures | **Nov 6: PUT 200** returns CONDUCE/delivery 10471, then **review 404** for the exact matching invoice/delivery pair; completion tests blocked |
| `GET /v1/journals?page=1&limit=1` | `400` — MongoDB `QueryExceededMemoryLimitNoDiskUseAllowed` |
| `POST /v1/journals/search` with `{ "filters": [] }` | `500` unexpected search error |
| `GET /deliveries/10464/invoices/6a323358a08ce327600a5ef1/items` for a row listed under delivery 10464 | `404 invoice is not assigned to this delivery` |

The portal always sends a closeout or reconciliation filter, so the journal
list/search errors do not affect shipped screens; the script does not repeat
them to avoid loading the database.

## Historical write-test results (November 3, 2026)

These results describe the old deployment. In particular, non-cash application
on create, permission availability, references and reversal behavior have changed;
use the November 6 matrix and remaining-defect reproduction above.

| Behavior | Result |
| --- | --- |
| Journal `autoClear` without `canReconcileJournal` | **Done** — `403`, nothing created, invoice unchanged |
| INVENTORY `autoReconcile` without `canReconcileInventoryDispatch` | **Done** — `403 AUTO_RECONCILE_FORBIDDEN` |
| Non-cash (Zelle) payment applies to the invoice on create | **Done** — balance 120 → 119 while the journal is Outstanding |
| Reversing an Outstanding payment restores the invoice | **Done** |
| Expense paid by Zelle from a bank account | **Done** — debit expense, credit bank |
| Cash income into a chosen cash account | **Missing** — ignored, posts to CASH ON HAND |
| Stable duplicate-payment code | **Missing** — message only |
| INITIAL-PAYMENT `refNumber` defaults to invoice number | **Missing** — INV-26-001453 got `TXN-00000073` |
| Delivery completion requires zero balance | **Missing** — completed with $70 owed |
| Manual closeout close/open | **Retired** — both return `409 closeout lifecycle is server-managed` |
| Journal closeout selection | **Done** — payload `branch` is ignored; the user's location selects the closeout |
| Receipt post → `PENDING_CONFIRMATION`; stock waits for confirmation | **Done** — `submittedAt`/`submittedBy` set, no stock moved |
| Receipt confirm/reject without confirmation grants | `403 inventory permission denied` |

## Still unverified

Daily-route snapshot recheck (November 5): full invoice snapshots are live on
list/detail and searchable by `dailyRoute.id`. A newly assigned appointment
also returns the full snapshot on detail/search, while sampled older appointment
21822 still lacks it. Close the blanket "add snapshot fields" TODO, retaining
historical backfill, immutability and Swagger follow-ups. Ledger dispatches
still have one `toHolderId`; `ROUTE_CREW` is an existing composite primitive,
but the arbitrary joint-assignment contract and reconciliation semantics are
not established. Both temporary appointments were deleted. See the
[full evidence and cleanup](../daily-route-accountability.md#ledger-joint-holders-and-appointmentinvoice-snapshots--november-5-2026).

- Write-time `409 CLOSEOUT_REQUIRED` remains unverified. November 6 explicit
  closeout creation succeeded, but no journal was posted before that opening.
  The earlier manual-close and branch-selection observations below describe
  November 5, not a new test of the current contract.
- November 5 follow-up: branch 1 `/current` returns open closeout **32691** with
  `timezone: America/New_York`. Branch 2 `/current` is null and `/context`
  reports `requiredReason: LATEST_CLOSED` (latest closed **32650**); this is
  **not** a verified write-time `409 CLOSEOUT_REQUIRED`. The available user's
  location remains branch 1, and a one-cent journal carrying `branch.id: 2`
  still posted to 32691. Both labeled SALES probes were reversed. Manual
  open/close guards returned server-managed `409` for a nonexistent numeric ID;
  current/context and the error code were absent from the then-published 242-path Swagger.
  November 6 explicit creation opened closeout **32692** and closed **32691**;
  the historical `/current` observation is not current state.
  See the [full closeout recheck](../transaction-triggered-closeouts.md#live-verification--november-5-2026).
- Two-party handoff, return/sale confirmation, one-cent credit allocation and
  settlement/replay now pass. Remaining outcomes, inventory method parity,
  concurrency/failure atomicity and arbitrary joint-holder effects are unverified.
- Positive-stock journal holders/linkage and two-user transfer are verified.
- Assigned-invoice server validation remains unverified: the restricted full-create
  sync denial passes, but a valid assigned positive control is still needed.
- Valid selected cash posting/readback and pre-clear invoice-payment corrections
  remain open as detailed in the November 6 matrix.

## Mock records left by the write tests

### November 3 historical fixtures

All tagged `ZZ_GAP_PROBE`. Journals were reversed (originals and reversals
stay Outstanding until someone with `canReconcileJournal` approves them).
Not reversible: INITIAL-PAYMENT invoice **INV-26-001453** ($0 registration),
receipt `a595ac87-eadf-4048-a0bd-3996c8838e97` (then PENDING_CONFIRMATION;
not cleaned up or reread in the November 6 mutation follow-up), active probe item
`24c117b8-20d6-4ce9-a6ca-809e86b94328` and supplier
`678b1ff4-f7cb-4103-baaf-6f9382357408`, and barcode **ET042260426** on invoice
488970 marked delivered.

### November 6 authorized mutation fixtures

Opened USD/rate-1 closeout **32692** for November 6; creation also closed prior
closeout **32691**. Today's closeout remains open. Created 16 original journals:
**14 are confirmed REVERSED by final GET**, and their tagged summaries total
income/expenses/net zero. Original and offsetting audit records remain.

Two invoice-owned INITIAL-PAYMENT fixtures remain ACTIVE because journal reversal
returns `409 Journal entry is managed by invoice lifecycle`:

| Invoice | Invoice ID | Journal ID | Amount |
| --- | --- | --- | --- |
| INV-26-001482 | `6aee1104d037620215133a66` | `6aee1104d037620215133a67` | $0.01 |
| INV-26-001483 | `6aee1105d037620215133a6c` | `6aee1105d037620215133a6d` | $0.01 |

Their tagged sender/receiver records remain. Combined retained ledger effect:
**$0.02 cash debit and $0.02 SALES credit**. The invoices were not deleted, since
previous audits showed that deletion could leave their journals behind. Exclude
these fixtures from meaningful mock reporting or repair through a supported
backend invoice-lifecycle operation.

Receipt **25650aff-77c8-4aee-9c7b-a67f2bc51252** is confirmed **CANCELLED** after
rejection to DRAFT and a bodyless cancel command. Its journal is reversed.
Warehouse stock remains empty. Existing invoice **475917** ends at its original
**cost $120, payment $0, balance $120**. No auth bypass or direct database changes
were used.

Probe tags:

- `ZZ_RELEASE_20261106_1793986737485`
- `ZZ_RELEASE_FOLLOWUP_1793986819658`
- `ZZ_RELEASE_INVENTORY_1793986862621`
- `ZZ_RELEASE_FINAL_1793986914468`

### November 6 remaining-issue follow-up fixtures

Final read-only audit confirms the two new payment journals and INVENTORY
journal **6aee134cd037620215133a9c** are REVERSED; their tagged financial
summaries net to zero. Existing invoice **475917** is unchanged at $120 cost,
$0 payment, $120 balance.

Inventory receipt **ec3fe8bd-886f-4542-b51d-98c4c9dc8274** remains POSTED as
confirmation evidence. Cleanup adjustment **08587ffe-493f-4aab-b4ba-9e2d47becd47**
is POSTED and removes its two units. Probe item
**a72f3999-befd-48f7-baa0-c94ddb066526** is inactive, with **zero on-hand and zero
reserved** stock. All three probe dispatches are confirmed CANCELLED:

- `97132f6d-a7dd-4292-b260-35d1ceb9bdab`
- `d446a147-3062-4619-9474-f93b85cf1942`
- `669c9ab3-21e3-4a0b-8464-1d470a5a0022`

The tagged EMPLOYEE holder **e5d2700d-fb59-4b99-9e98-2e0bfe411d7f** remains active
for employee 2, with no probe stock. No holder deletion/deactivation route is
published. Five temporary invoices and deliveries **10470 / 10471** are confirmed
404 after deletion; generated catalog barcodes **193 / 194** also return 404.
Sequence consumption and audit history are retained.

The self-pool test leaves reserved number **INV-26-001484**
(`6aee13ded037620215133ab6`) unclaimed in the company pool (`userId: 0`), after
return from user 73. No extra reservation was generated by replay. The two
$0.01 initial-payment registrations from the earlier release run remain as
previously disclosed; this follow-up created no additional INITIAL-PAYMENT journal.

Follow-up tags: `ZZ_REMAINING_FINANCE_1793987351610`,
`ZZ_REMAINING_INVENTORY_1793987395557`,
`ZZ_REMAINING_DELIVERY_20261106_1793987411440`,
`ZZ_REMAINING_EMBEDDED_1793987525441`,
`ZZ_REMAINING_CATALOG_1793987598905`.

### Restricted-user test accounts and retained audit fixtures

Final API audit confirms:

- User **87** is inactive, linked to minimal custodian/read role **13**; its
  original Firebase UID is restored and preserved. Employee **211** is inactive.
- Fresh self-only user **88** is inactive with role **15** (only the self-pool
  grant). Both test tokens now receive **403** on `/users/current`.
- Auxiliary dual-confirmation/journal-create role **14** and assigned-only role
  **16** are inactive. No administrative grants were assigned to either account.
  Firebase identities remain; tenant access is disabled. Generated credentials
  were kept outside the repository in a private local file, never in this document.
- Dispatch **c2b92d0b-5533-4186-a786-0d3d605108d6** remains POSTED as audit history,
  fully reconciled: two units returned, one sold, **zero pending claims**. Failed
  or reset test claims are REJECTED; three actual outcome claims are CONFIRMED.
- The confirmed two-cent supply sale, verified one-cent bank payment, allocation
  and settlement remain as labeled inventory history. Obligation
  **206998de-2cb6-4ea3-ba29-c86cfa447fa6** is **SETTLED**, amount/settledMinor 1,
  with exactly one settlement. Ledger reversals do not erase this supply-sale
  history or represent a bank refund; exclude the fixtures from meaningful mock
  supply-sales reporting.
- Generated bank income and the allowed-create control are confirmed REVERSED:
  **6aee171cd037620215133ac7**, **6aee171fd037620215133aca** and
  **6aee1816d037620215133ad2**. Existing invoice 475917 remains cost $120,
  payment $0, balance $120.
- Probe item **5f4508fd-5598-4c94-b6c8-58e346b5b596** is inactive with zero
  on-hand/reserved stock at both holders. Compensating adjustments restored
  isolated fixture stock between test stages and removed it afterward. The
  dedicated holder **3f9861c8-0bc6-477b-97ea-6a52a3b7ab68** remains with zero stock.
- Eight temporary appointments, four vehicles, two daily routes and two crews
  are confirmed deleted (GET 404). The extra test driver is inactive. Two tagged
  customers **6aee186cd037620215133ad9 / 6aee186cd037620215133adb** remain inactive:
  DELETE timed out and GET still found them, so cleanup used successful
  deactivation rather than claiming deletion. No assigned-invoice fixture was
  created by the generic-400 requests.

Primary audit tag: `ZZ_TWO_USER_1793988071272`; return/sale follow-up suffix
`_STABLE_ROLE`. User/role prefix: `ZZ_CUSTODIAN_TEST_1793987909808`. The earlier
initial-payment fixtures and unclaimed INV-26-001484 remain as already disclosed.

## Updating this page

Re-run the script after each backend deploy, update the status column and the
linked document's status line, and record the date. Do not mark an item done
from documentation or Swagger alone.
