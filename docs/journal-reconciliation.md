# Daily Income and Pending Transactions

Implemented in source; deployment, tenant permission seeding and data cutover are separate operations.

Daily Income remains scoped to one closeout. Accounting → Pending Transactions keeps its existing route and searches all closeouts with a fixed reconciliationStatus eq OUTSTANDING filter. Both pages use the same journal columns, advanced filter definitions, server pagination, sorting by date/createdAt, selection and per-currency Income / Expenses / Net totals.

The source contract is [journal-reconciliation.md in EMSYS API](https://github.com/embarques/emsys-api/blob/dev/docs/contracts/journal-reconciliation.md). The journal portion of api-docs.json is refreshed from generated Swagger, including summary/reconcile endpoints and server-owned fields.

## Completed

- Server search replaces the 500-row download and browser pagination. Default requests fetch 50 rows; page sizes remain bounded at 500. Fixed closeout/Outstanding scope is ANDed with the user's filter expression, so OR filters cannot escape it.
- Advanced filters include invoice, transaction, closeout, date/range, creator, accounts, financial amounts, employee name/ID, payment method, check number, references, reconciliation and (on Pending Transactions) branch.
- Check/reference strings retain leading zeros; employee ID equality is numeric while text operators search its string form.
- Matching totals use /journals/summary filters. Selected totals send up to 200 IDs across pages. Currencies remain separate.
- Reconcile requires canReconcileJournal, a confirmation and one payment method. Selection changes replace the request ID; retrying an unchanged failed request reuses it. Success refreshes accounting queries without invalidating invoices.
- Auto-approve uses only canReconcileJournal for all transaction types/methods, including cash and inventory. No per-method permission fallback remains.
- Method directories are view-only; their status comes from the linked journal.
- The sidebar badge reads Outstanding journal search total with limit 1, including cash. Retired per-method badges no longer duplicate this count.
- Every payment applies to the invoice when recorded. Delivery requires the authoritative zero balance and has no pending-payment coverage override.
- English/Spanish payment and approval copy reflects this lifecycle.

## Coordinated rollout

Deploy the matching API change before enabling these clients. Refresh tenant indexes, the admin-only journal reconciliation permission seed and permission caches.

Historical financial migration is deliberately **not automatic**. The existing bounded, dry-run-first status backfill classifies reconciliation and preserves invoicePaymentApplied evidence. Approval never changes invoices, including old unpaid deferred receipts. Review and resolve those receipts through a separately approved monetary adjustment before client cutover. Do not run old clearing writers during classification/cutover.

Reconciled journals are final. Only eligible Outstanding journals may use the existing audited reversal workflow. Inventory dispatch custody reconciliation remains separate.

## Validation and performance scope

TypeScript, all 311 unit tests and the production webpack build pass. Changed-file ESLint passes; whole-repository ESLint also runs and reports four pre-existing no-assign-module-variable errors in unrelated tests. Browser regression covers cross-page selection, mixed-method prevention, confirmation, stable retry IDs, view-only permission behavior and accounting-only requests.

Request-shape regression verifies one search request per requested page (50 rows by default, compared with the old fixed 500) and a separate matching-summary request; a selection adds one summary request. No full-directory or N+1 row reads are introduced. These are bounded request-shape checks, not a claim of measured production latency improvement.

Grouping totals by employee, branch or method remains the separately specified follow-up requiring an extended aggregation contract.
