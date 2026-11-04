# Backend/API gaps — tracker

Single index of every backend/API TODO the portal depends on. Each linked
document keeps the detailed contract; this page records what is live.

Last verified **November 3, 2026** against `https://api.embarqueros.com/v1`
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

## Where the gaps live

| Document | Area | Live status |
| --- | --- | --- |
| [reconciliation-permissions-api-todo.md](reconciliation-permissions-api-todo.md) | `canReconcileJournal` / `canReconcileInventoryDispatch` seed and enforcement | **Open** — enforced everywhere, not seeded |
| [pending-transactions-update.md](pending-transactions-update.md) | Journal reconciliation, search, summary, reconcile, payment-on-create | **Mostly live** — backfill and `canListJournal` open |
| [payment-accounts-api-contract.md](payment-accounts-api-contract.md) | Cash/bank umbrellas, Debit card/Wire, expenses, refNumber default | **Open** — only non-cash expenses work |
| [delivery-completion-api-contract.md](delivery-completion-api-contract.md) | Zero-balance enforcement on completion | **Open — not enforced** |
| [inventory-dispatch-workflows.md](inventory-dispatch-workflows.md) | Two-party confirmation and dispatch reconciliation | **Partly live** — permissions not seeded; Daily Income inventory gaps |
| [assigned-invoice-api-contract.md](assigned-invoice-api-contract.md) | `canCreateAssignedInvoice` | **Open** — permission not seeded |
| [closeout-transaction-edits.md](closeout-transaction-edits.md) | Editing journals in the current open closeout (`PUT /journals/{id}`) | **Unverified** — documented; needs a `--writes` run |
| [transaction-triggered-closeouts.md](transaction-triggered-closeouts.md) | `CLOSEOUT_REQUIRED` and backend-directed rollover | **Partly verified** |
| [daily-route-accountability.md](daily-route-accountability.md) | Supervisor + daily route snapshot; inventory holders | **Live** for journals; inventory holders blocked by a 500 |
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
3. **Enforce zero balance on delivery completion.** Completion succeeded on
   invoice 488970 with a $70 balance (delivery 10464, `deliveredCount: 1`).
4. **Backfill `reconciliationStatus`.** Only 3 of ~24,110 `PAYMENT` journals
   have a stored status, so older journals never match the Pending
   Transactions `reconciliationStatus eq OUTSTANDING` filter. The backfill rule
   is still an open decision.
5. **Payment accounts:** cash `paymentAccount` is accepted but ignored (always
   posts to CASH ON HAND, not returned, no 422 for an EXPENSE account); no
   default BANK system account; no `DEBIT-CARD` / `WIRE`; auto-numbered invoice
   payments get `TXN-…` references instead of the invoice number; the duplicate
   409 has no machine-readable code.
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
| `POST /v1/deliveries/{id}/invoices/{invoiceId}/complete` with a nonzero balance | `200 Delivery completed` |
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

- `409 CLOSEOUT_REQUIRED`: manual close is retired and the payload branch is
  ignored, so it can only be triggered by posting before today's closeout
  exists (e.g. the first transaction of a new day) or as a user located in a
  branch without a closeout (branch 2 / RD has none).
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
