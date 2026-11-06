# Backend/API gaps — pending work

Last verified **November 6, 2026** against `https://api.embarqueros.com/v1`,
mock company `64d5c0b0d1eab2aaf30b1819`. Only unresolved defects, verification
and follow-up work remain here. Detailed evidence and retained-record IDs are in
the [verification archive](archive/backend-api-verification-2026-11-06.md).

## Confirmed defects

1. **User updates clear the Firebase UID when omitted.** `PUT /users/87`
   returned 200, subsequent GET omitted the UID, and Firebase-authenticated API
   access returned 403. Restoring the original UID restored access. Preserve the
   existing UID on ordinary updates; the portal's update payload omits it.

2. **Uncleared Debit/Wire invoice payments cannot be edited or reversed.**
   `PUT /journals/{id}` and `POST /journals/{id}/reverse` return
   `409 Invoice balance cannot be negative` despite a fresh `expectedVersion`
   and eligible `allowedActions`. Reproduced with $0.02/$0.03 payments against
   invoice 475917, starting balance $120/payment $0. Correct the deferred-receipt
   adjustment path without requiring bank clearance first.
   See [payment accounts](payment-accounts-api-contract.md) and
   [journal edits](closeout-transaction-edits.md).

3. **Self-pool generation rejects the self-service grant.** Fresh user 88,
   role 15, has exactly `canGenerateOwnInvoicePool` (`invoice_pool_self:create`).
   `POST /invoices/reserved/actions` with `action: generate-self`, a new UUID and
   `count: 1` returns `403 invoice pool permission required`; admin execution
   works. Fix restricted execution, then verify own listing without pool-view
   permission and foreign-user isolation.

4. **BANK child creation fails with a misleading validation error.**
   `POST /chart-accounts` with documented `type`, `displayName` and
   `parentAccount` returns `400 chart account type and display name are required`
   under both the BANK umbrella and an existing BANK account. The EXPENSE-parent
   control returns the same error, so it does not prove parent-type validation.
   Resolve creation before testing hierarchy constraints.
   See [payment accounts](payment-accounts-api-contract.md).

5. **Barcode assignment and delivery review disagree.** Updates to newly
   created catalog barcodes returned 200 with CONDUCE and delivery 10471 saved;
   review of the exact matching invoice/delivery pairs returned
   `404 invoice is not assigned to this delivery`. An invoice-embedded update
   also returned 200 while retaining ALM-NY and omitting delivery. Fix assignment
   persistence/readback so isolated delivery completion can be exercised.
   See [delivery completion](delivery-completion-api-contract.md).

6. **Legacy reconciliation status remains incomplete.** The latest count
   before the follow-up's new payments was 24,130 PAYMENT rows, with only
   3 matching OUTSTANDING and 0 RECONCILED. Define and apply the historical
   backfill rule so eligible older entries appear in Pending Transactions.
   See [pending transactions](pending-transactions-update.md).

## Pending verification and contract decisions

- **Valid cash-account selection and account safeguards.** Provide a persisted
  CASH ON HAND hierarchy and a valid posting child in the mock company. Its only
  custom ASSET is an orphan and cannot establish successful chosen-account
  posting/readback. Verify create/sync/update, INITIAL-PAYMENT selection, cash
  expenses, inactive and tenant/branch scope, BANK deletion/type protection,
  parent validation, cycles and cash/bank report roll-ups.
  See [payment accounts](payment-accounts-api-contract.md).

- **Assigned-only invoice creation.** Role 16 lacks full invoice-create access.
  The proposed valid `/invoices/sync/create-assigned` request and assignment/
  receiver-negative variants all return generic `400 Invoice request is invalid`,
  including a one-cent request with an explicit receivedBy route discriminator.
  Establish a valid positive request or correct the contract before certifying
  creation/replay and appointment/customer enforcement.
  See [assigned invoices](assigned-invoice-api-contract.md).

- **Remaining delivery balance cases.** After fixing assignment/review, verify
  zero, negative/unavailable balances, uncleared receipts and concurrent invoice
  changes. Do not add an override to the published no-override contract.
  See [delivery completion](delivery-completion-api-contract.md).

- **Permission combinations and refresh behavior.** Verify legacy CRUD grants
  cannot substitute for standalone capabilities, inventory `autoReconcile` with
  an accepted create control, and broader tenant/branch isolation. Role edits
  exposed new grants through `/users/permissions` before the action accepted
  them; establish the intended authorization cache/refresh behavior.
  See [reconciliation permissions](reconciliation-permissions-api-todo.md).

- **Inventory edge cases and payment-method parity.** Verify remaining
  DAMAGED/LOST/MISSING/STOLEN/TRANSFERRED outcomes, concurrency and failure
  atomicity. Decide and document Debit/Wire support for inventory reconciliation:
  WIRE returned `422 unknown accounting payment method`, and the inventory
  payment enum excludes both methods. Journal support does not establish this
  separate contract. See [inventory workflows](inventory-dispatch-workflows.md).

- **Daily-route historical snapshots and joint custody.** Verify legacy
  snapshot coverage, immutability and schema alignment. Define arbitrary joint
  assignment and reconciliation semantics beyond the existing single-holder
  ledger/ROUTE_CREW model. See [daily-route accountability](daily-route-accountability.md).

- **Write-time closeout recovery.** Verify `409 CLOSEOUT_REQUIRED` when posting
  without the current closeout, including rollover and concurrency. Explicit
  closeout creation does not prove this error path; do not close the shared
  current period merely to force it.
  See [closeout contract](transaction-triggered-closeouts.md).

- **Historical unfiltered journal errors need a safe recheck.** Unfiltered
  `GET /journals?page=1&limit=1` previously returned MongoDB
  `QueryExceededMemoryLimitNoDiskUseAllowed` (400), and empty-filter journal
  search returned 500. They were not repeated because of the known database-load
  risk. Reproduce in an isolated dataset and verify bounded/indexed queries.

## Documentation and mock-data follow-up

- Refresh local `api-docs.json`: 242 paths versus 297 live, missing 55 paths,
  with the old journal DELETE description. Align older feature-document status
  lines and contracts with verified behavior.
- Provide a supported invoice-lifecycle repair for retained mock initial-payment
  journals. INV-26-001482/001483 retain $0.02 combined cash/SALES postings; six
  earlier invoice-owned journals remained active after their invoices were
  deleted. Use the [archive](archive/backend-api-verification-2026-11-06.md) and
  [retained-journal details](payment-accounts-api-contract.md#live-mutation-verification--november-5-2026)
  for IDs. Exclude retained tagged fixtures from meaningful mock reporting until
  repaired through supported operations.
