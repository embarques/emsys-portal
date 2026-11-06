# Backend/API gaps — tracker

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

### Targeted recheck — November 5, 2026

Read-only GET/search checks against the same company with an Administrador
token confirm that the three November 4 TODOs remain open:

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

**Chosen cash-account mutation recheck (November 5):** item 2 remains open.
Create and sync for PAYMENT, SALES and INITIAL-PAYMENT ignored supplied ASSET
and EXPENSE destinations, always debited CASH ON HAND, and omitted
`paymentAccount` on read. PAYMENT/SALES PUT did the same; INITIAL-PAYMENT PUT
returned lifecycle `409`. Twelve PAYMENT/SALES journals were reversed; six
new mock invoices were deleted, but their labeled INITIAL-PAYMENT journals
remain ACTIVE/Outstanding ($0.81 cash, $5.19 receivables, $6 revenue).
See the [full matrix and retained-record IDs](payment-accounts-api-contract.md#live-mutation-verification--november-5-2026).

**Debit card / Wire mutation recheck (November 5):** item 3 is partly supported.
The catalog endpoint exists but omits both methods. PAYMENT, SALES and
INITIAL-PAYMENT create, PAYMENT sync and PAYMENT/SALES update reject them with
`400 Payment method is not supported`. EXPENSE create/update accepts both,
but marks clearance `NOT_REQUIRED`, unlike matching ZELLE/DEPOSIT expense
controls (`OUTSTANDING`). Scoped `eq`/`neq` filters and filtered currency totals
work; payment-method grouping is not part of the documented summary contract.
All 12 journals created in this method audit were reversed. See the
[method matrix, reporting limits and cleanup tags](payment-accounts-api-contract.md#debit-card--wire-live-verification--november-5-2026).

**Expense-method mutation recheck (November 5):** item 4 is **partly live**,
superseding the earlier posting-only "done" finding. All seven methods post
expenses and appear in pending search and original-journal summaries. Wrong-type,
nonexistent and spoofed sources are accepted; omitted non-cash sources default
to CASH ON HAND. Check expenses accept external/internal references instead of
requiring an explicit check number. A reversed $0.13 expense pair still reports
net -$0.13 in the summary. All 24 expense probe journals were reversed; real
tenant/branch and active-account validation remain unverified. See the
[expense matrix and cleanup tags](payment-accounts-api-contract.md#expense-method-live-verification--november-5-2026).

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
balance states, concurrency and override semantics remain open. See the [current behavior and recheck limits](delivery-completion-api-contract.md#current-portal-audit--november-5-2026).

| Document | Area | Live status |
| --- | --- | --- |
| [reconciliation-permissions-api-todo.md](reconciliation-permissions-api-todo.md) | `canReconcileJournal` / `canReconcileInventoryDispatch` seed and enforcement | **Open** — enforced everywhere, not seeded |
| [pending-transactions-update.md](pending-transactions-update.md) | Journal reconciliation, search, summary, reconcile, payment-on-create | **Mostly live** — backfill and `canListJournal` open |
| [payment-accounts-api-contract.md](payment-accounts-api-contract.md) | Cash/bank umbrellas, Debit card/Wire, expenses, refNumber default | **Open** — expense posting works; source/reference validation and reversal-aware summaries fail |
| [delivery-completion-api-contract.md](delivery-completion-api-contract.md) | Zero-balance enforcement on completion | **Partly verified Nov 5** — positive balance rejected with 409; zero/negative/concurrency/override cases open |
| [inventory-dispatch-workflows.md](inventory-dispatch-workflows.md) | Two-party confirmation and dispatch reconciliation | **Partly live** — permissions not seeded; Daily Income inventory gaps |
| [assigned-invoice-api-contract.md](assigned-invoice-api-contract.md) | `canCreateAssignedInvoice` | **Open** — permission not seeded |
| [closeout-transaction-edits.md](closeout-transaction-edits.md) | Editing journals in the current open closeout (`PUT /journals/{id}`) | **Unverified** — documented; needs a `--writes` run |
| [transaction-triggered-closeouts.md](transaction-triggered-closeouts.md) | `CLOSEOUT_REQUIRED` and backend-directed rollover | **Partly verified Nov 5** — current/context and branch selection live; write conflict and Swagger open |
| [daily-route-accountability.md](daily-route-accountability.md) | Supervisor, daily route snapshots and joint inventory holders | **Snapshots live** for journals/invoices/newly assigned appointments; legacy coverage and ledger joint-holder contract open; inventory journal holders previously blocked by 500 |
| [invoice-policies-api-todo.md](invoice-policies-api-todo.md) | Invoice policy CRUD | **Done** |
| [predefined-routes.md](predefined-routes.md) | Predefined route catalog and pickup filter | **Done** |
| [stale-update-protection.md](stale-update-protection.md) | Invoice/customer `If-Match` | **Done** |
| [inventory-swagger-verification.md](inventory-swagger-verification.md), [inventory-workflow.md](inventory-workflow.md) | Inventory write capabilities, PUT routes | Portal-side limitations; not re-checked |
| [verification-issues.md](verification-issues.md) | Portal test/lint follow-ups | Portal-side; not API work |

`docs/archive/` holds closed historical confirmations and is not tracked here.

## Open backend work

Ordered by what blocks shipped portal features first.

1. **Seed the reconciliation grants.** `canReconcileJournal` and
   `canReconcileInventoryDispatch` are enforced on every path (reconcile
   endpoints, journal `autoClear`, inventory `autoReconcile` →
   `AUTO_RECONCILE_FORBIDDEN`), but neither exists in `GET /v1/permissions`,
   so no role, including Administrador, can reconcile or auto-approve.
   See [reconciliation-permissions-api-todo.md](reconciliation-permissions-api-todo.md).
2. **Seed the other permissions the portal already checks:** `canListJournal`
   (Pending Transactions list gate; the portal falls back to
   `canViewFinancialActivity`), `canConfirmInventoryWarehouse`,
   `canConfirmInventoryCustodian` (receipt confirm/reject return
   `403 inventory permission denied` for Administrador) and
   `canCreateAssignedInvoice`.
3. **Finish delivery balance-gate verification.** The approved November 5
   probe rejected invoice 488970 / delivery 10464 with $70 owed (`409`),
   superseding the November 3 successful nonzero completion. Verify zero and
   negative/unavailable balances, uncleared-payment handling, concurrent invoice
   changes and override acknowledgment/audit behavior before closing the full gap.
4. **Backfill `reconciliationStatus`.** Only 3 of 24,116 `PAYMENT` journals
   have a stored status, so older journals never match the Pending
   Transactions `reconciliationStatus eq OUTSTANDING` filter. The backfill rule
   is still an open decision in the documented contract. Counts rechecked November 5.
5. **Payment accounts:** cash `paymentAccount` is accepted but ignored (always
   posts to CASH ON HAND, not returned, no 422 for an EXPENSE account); no
   default BANK system account; no `DEBIT-CARD` / `WIRE`; auto-numbered invoice
   payments get `TXN-…` references instead of the invoice number; the duplicate
   409 has no machine-readable code. Expense posting works for all seven
   methods, but source lookup/pairing, explicit Check numbers and reversal-aware
   expense summaries fail (November 5 probes above).
6. **Daily Income inventory journals:** a *received* INVENTORY journal posts
   accounting lines but creates no ledger receipt and no stock; a *dispatched*
   INVENTORY journal with valid `inventoryHolders` returns `500` (expected a
   4xx such as `INSUFFICIENT_STOCK` when the warehouse has no stock).
7. **Publish an up-to-date Swagger.** `https://api.embarqueros.com/swagger/doc.json`
   (and the portal's `api-docs.json` copied from it) omits live routes:
   `/journals/reconcile`, `/journals/summary`, `/journals/{id}/reverse`,
   `/financial-activity`, `/predefined-routes`, `/deliveries/assigned-barcodes`,
   `/inventory/pending-dispatches/search`,
   `/inventory/dispatches/{id}/reconciliations`. Do not treat a route's
   absence from `api-docs.json` as proof it is not deployed.
8. **Define `canGenerateOwnInvoicePool`** (`invoice_pool`, "generate a reserved
   pool for yourself"). The portal does not use it yet. Document the request
   it authorizes (e.g. `POST /invoices/reserved/actions` `generate` with the
   caller's own linked employee, without `canGenerateInvoicePool`), whether
   the caller can then list their own numbers without `canViewInvoicePool`, and
   reject any other `employeeId` for callers holding only this grant. Update
   the emsys-api `docs/contracts/reserved-invoice-pools.md` contract and seed it.

## Live API defects observed

| Request | Result |
| --- | --- |
| `POST /v1/deliveries/{id}/invoices/{invoiceId}/complete` with a nonzero balance | November 3: `200`; **superseded November 5: balance-gate `409`, unchanged invoice/pieces** |
| `POST /v1/journals` INVENTORY dispatched with `inventoryHolders` | `500` unexpected error |
| `GET /v1/journals?page=1&limit=1` | `400` — MongoDB `QueryExceededMemoryLimitNoDiskUseAllowed` |
| `POST /v1/journals/search` with `{ "filters": [] }` | `500` unexpected search error |
| `GET /deliveries/10464/invoices/6a323358a08ce327600a5ef1/items` for a row listed under delivery 10464 | `404 invoice is not assigned to this delivery` |

The portal always sends a closeout or reconciliation filter, so the journal
list/search errors do not affect shipped screens; the script does not repeat
them to avoid loading the database.

## Write-test results (November 3, 2026)

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
[full evidence and cleanup](daily-route-accountability.md#ledger-joint-holders-and-appointmentinvoice-snapshots--november-5-2026).

- `409 CLOSEOUT_REQUIRED`: manual close is retired and the payload branch is
  ignored, so it can only be triggered by posting before today's closeout
  exists (e.g. the first transaction of a new day) or as a user located in a
  branch without a closeout (branch 2 / RD has none).
- November 5 follow-up: branch 1 `/current` returns open closeout **32691** with
  `timezone: America/New_York`. Branch 2 `/current` is null and `/context`
  reports `requiredReason: LATEST_CLOSED` (latest closed **32650**); this is
  **not** a verified write-time `409 CLOSEOUT_REQUIRED`. The available user's
  location remains branch 1, and a one-cent journal carrying `branch.id: 2`
  still posted to 32691. Both labeled SALES probes were reversed. Manual
  open/close guards returned server-managed `409` for a nonexistent numeric ID;
  current/context and the error code remain absent from the 242-path Swagger.
  See the [full closeout recheck](transaction-triggered-closeouts.md#live-verification--november-5-2026).
- Two-party confirmation effects, dispatch reconciliation with payments,
  credit sales: blocked until the confirmation and reconcile grants are seeded.
- `inventoryHolders` on dispatched INVENTORY journals: blocked by the `500`.
- Assigned-invoice server validation: blocked until `canCreateAssignedInvoice`
  is seeded and assigned to a test user.

## Mock records left by the write tests

All tagged `ZZ_GAP_PROBE`. Journals were reversed (originals and reversals
stay Outstanding until someone with `canReconcileJournal` approves them).
Not reversible: INITIAL-PAYMENT invoice **INV-26-001453** ($0 registration),
receipt `a595ac87-eadf-4048-a0bd-3996c8838e97` (PENDING_CONFIRMATION; reject
needs the confirmation grant), active probe item
`24c117b8-20d6-4ce9-a6ca-809e86b94328` and supplier
`678b1ff4-f7cb-4103-baaf-6f9382357408`, and barcode **ET042260426** on invoice
488970 marked delivered.

## Updating this page

Re-run the script after each backend deploy, update the status column and the
linked document's status line, and record the date. Do not mark an item done
from documentation or Swagger alone.
