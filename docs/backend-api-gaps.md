# Backend/API gaps — pending work

Unresolved defects, contract decisions and acceptance work, updated November 11,
2026. API shapes are defined in [api-docs.json](../api-docs.json).

## Confirmed remaining defects

- **Historical reconciliation/filter coverage is still incomplete in this tenant.**
  On the November 7 live recheck, PAYMENT search returned 24,134 rows; adding
  `OUTSTANDING` returned 3, and `RECONCILED` returned 0. The oldest sampled
  PAYMENT has an empty status.
  Journal `6aee1319d037620215133a92` reads as `OUTSTANDING` but disappears
  when that status is added to its exact-ID search. Confirm backfill deployment
  and execution, review ambiguous rows and verify safe reruns
  and unchanged invoice balances. See [financial controls](financial-controls.md).

- **Pickup role changes leave authorization inconsistent.** Adding assigned
  update is visible through `/users/permissions` but owned writes still return
  403 after token refresh and a fresh sign-in. Removing assigned update removes
  it from the permission response, yet owned writes still return 200 and persist,
  including after a fresh sign-in. Adding assigned view to an update-only role
  likewise leaves list access denied. Fix stale cache/role-snapshot enforcement,
  define propagation guarantees and verify both grant additions and revocations.
  See [assignment authorization gaps](daily-route-assignment-api-contract.md).

- **Invoice discounts are classified as expenses.** Discount journals debit
  `SALES DISCOUNTS`, which the API types `EXPENSE`. A discount reduces accounts
  receivable and moves no cash or bank funds, so it must not count as an expense
  or reduce the closeout's cash total. Make `SALES DISCOUNTS` a contra-revenue
  account, post every discount as debit `SALES DISCOUNTS` / credit
  `ACCOUNTS RECEIVABLE`, and exclude it from closeout expense and cash totals.
  Until then the portal excludes `SALES DISCOUNTS` from its session total and
  journal expense totals by account name.

- **Journal create hangs after a failed create.** When `POST /journals` is
  rejected (e.g. duplicate invoice number) and the user corrects the entry and
  saves again, the retry never responds. In development the Next.js proxy drops
  it after 30 seconds (`socket hang up`, `ECONNRESET`) and the portal shows
  "Request failed (500)"; without the proxy the save likely stays pending until a
  server or gateway timeout. The portal resets its submit state after the first
  error and posts the corrected values, so the stall is server-side. Suspected cause: the failed create does not fully
  roll back and keeps a lock (closeout, invoice number counter or similar) that
  blocks the next write. Ensure every failed create aborts its transaction and
  releases its locks, and confirm whether the timed-out retry still commits,
  since a further retry could post a duplicate entry.

## Pending verification and contract decisions

- **Daily-route assignment edge cases.** Verify foreign-tenant batches,
  scoped delivery/invoice actors, concurrent membership-revocation races and
  server business-midnight behavior,
  legacy-enabled pickup completion, invoice bulk atomicity and actual delivery
  completion versus barcode movement/removal. Resolve invoice-embedded removal
  and catalog/embed/numeric-delivery/trip consistency. Publish the remaining
  backend removal and business-date contracts. See the
  [pending assignment fixes and verification](daily-route-assignment-api-contract.md).

- **Valid cash-account selection and account safeguards.** Provide a persisted
  CASH ON HAND hierarchy and a valid posting child in the mock company. The
  fresh bounded cash lookup still finds only orphan ASSET 4, Cash Account, which
  cannot establish chosen-account posting/readback. Verify create/sync/update,
  INITIAL-PAYMENT selection, cash expenses, inactive and tenant/branch scope,
  BANK deletion/type protection,
  parent validation, cycles and cash/bank report roll-ups.
  See [payment accounts](payment-accounts-api-contract.md).

- **Customer address saves with legacy duplicate identities.** Verify the
  address-only partial-update payload against affected same-name/phone records,
  including `6a3228d8a08ce3276009c75f`; ensure unchanged identity fields do not
  prevent address maintenance. Clarify how to handle existing duplicate records
  while preserving linked appointment/invoice history and genuine identity-edit
  conflict protection.

- **Customer deletion history acceptance.** Establish commit-before-history
  ordering, seeded tenant history indexes and persisted deletion history using backend
  database evidence; `/user-activities` is not an authoritative history readback.
  Retire the older inactive fixtures through supported operations.

- **Assigned-only invoice edge cases.** Verify transaction-time assignment and
  linked-customer validation on `/invoices/sync/create-assigned`, including
  ownership/customer negatives, revoked assignments and races, replay after
  deletion, initial-payment effects
  and the portal entry point. Clarify why `canOperateDailyRoute` activates a
  protected-record 403 on assigned creation. Resolve branch-association 400s in
  custom-code branch 11 and generic 400s for explicit `receivedBy` variants;
  distinguish branch/payload requirements from missing permissions.
  See [assigned invoices](assigned-invoice-api-contract.md).

- **Remaining delivery balance cases.** Verify negative, unavailable/invalid
  balances, uncleared receipts, concurrent invoice changes, photo ownership, policy-negative cases and assigned-only crews.
  Preserve the no-override contract.
  See [delivery completion](delivery-completion-api-contract.md).

- **Permission combinations and refresh behavior.** Verify inventory journal
  `autoReconcile`, broader permission combinations and tenant/branch isolation.
  Resolve disagreement between `/users/permissions` and command authorization
  after role edits: reconciliation additions still returned 403 with the same
  token, and pickup additions/revocations remained stale after fresh sign-in.
  Establish propagation/cache invalidation guarantees, including revocation.
  See [reconciliation permissions](financial-controls.md).

- **Inventory edge cases.** Verify broader failure atomicity, races, valuation
  and reopen revisions. See [inventory workflows](inventory-workflow.md).

- **Daily-route historical snapshots and joint custody.** Verify legacy
  invoice/journal snapshot coverage, historical membership, responsible-party
  changes, permissions and client/schema alignment for remaining combinations.
  See [daily-route accountability](daily-route-accountability.md).

- **Write-time closeout recovery.** Verify STALE_OPEN_CLOSEOUT, LATEST_CLOSED,
  real rollover, injected failures and affected client draft flows. Confirm that
  retired scheduler jobs are absent from deployment.
  See [closeout contract](transaction-triggered-closeouts.md).

- **Journal query capacity.** Verify indexed query plans, representative load
  and performance budgets.

- **Voided/reversed journals leave the pending queues.** Assumed backend
  behavior; verify. Today a voided or reversed journal keeps
  `clearanceStatus`/`reconciliationStatus` `OUTSTANDING`, but
  `/journals/clear` and `/journals/reconcile` reject inactive entries, so it
  stays in Pending Clearance, Pending financial activity and both badges forever.
  - Void (`/journals/{id}/void`), reverse (`/journals/{id}/reverse`) and
    the reversal step of `/journals/{id}/correct` set both statuses to
    `NOT_REQUIRED` atomically with the void/reversal. Cover the original and
    its offsetting/reversal entry; a correction's replacement entry starts
    `OUTSTANDING` as usual. Never downgrade `CLEARED` or `RECONCILED` evidence.
  - Add `NOT_REQUIRED` to the `reconciliationStatus` enum in OpenAPI
    (currently `OUTSTANDING`/`RECONCILED` only).
  - Record void and reverse as `rare` (severe) user activity so they appear in
    User Activity and portal notifications. When the journal was pending bank
    clearance, include payment method and check/external reference so
    accounting can verify the bank side; a ledger reversal does not issue a
    bank refund.
  - Backfill existing voided/reversed journals that are still `OUTSTANDING`,
    then verify both queues, `/journals/summary` and both badge counts exclude
    them.
  - The portal needs no queue/badge change and already labels reconciliation
    `NOT_REQUIRED` as "Not required".

## Directory tables: search, filter, sort and selection coverage

Pending server-side search, filter and sort coverage, based on the November 7
API schema and live checks. See [api-docs.json](../api-docs.json).

- **Publish sort allow-lists.** No endpoint documents its accepted sort fields;
  only filter fields are listed ("Accepted filter fields: …"). Add an
  "Accepted sort fields" list per GET/search endpoint, generated from the same
  allow-list the handler enforces. Return 400 naming the rejected sort field
  instead of ignoring it, and back sortable columns with indexes. Verify all
  top-level column sorts for employee titles, employee departments, barcode
  statuses, invoice policies and predefined routes. Confirm chart-of-accounts
  sort support for `id`, `type`, `displayName`, `name`,
  `branch.code`, `parentAccount.name`, `description`, `systemAccount`,
  `default`, `branchAccount`, `createdAt` and `updatedAt`.
- **Generate "Accepted filter fields" from the enforced allow-list.** These
  fields are documented as accepted, but earlier live checks recorded in portal
  code comments returned 400. The portal does not offer them until a fresh
  check confirms which side is out of date:
  - `POST /chart-accounts/search`: `createdBy.name`.
  - `POST /inventory/receipts/search` and `/inventory/dispatches/search`:
    `notes`.
  - `POST /inventory/suppliers/search`: `addresses`, `contacts.email`,
    `contacts.name`, `contacts.phone`.
  - `POST /inventory/items/search`: `unitOfMeasure`, `currency`,
    `defaultSellingPriceMinor`.
  - `POST /pickups/search`: `routeNumber`, `legacySyncError`, `legacySyncedAt`,
    `completedBy.name` (already listed under Route Appointments below).
- **Fields the portal already sends that are not on the documented list.**
  User activity uses `id` (entity ID) in its search bar, filters and sort, but
  `POST /user-activities/search` lists only `activityId`, `description`,
  `documentId`, `origin`, `quantity`, `severity`, `timestamp`, `user.id` and
  `user.name`. Either document `id` or confirm strict validation would reject
  the whole bar search. Branches sorts its `address.address1`,
  `address.country` and `settings.labelPrefix` columns, which are not
  filterable (400 per portal notes); confirm whether they are sortable.
- **Accepted filters that match nothing.** `timestamp` on
  `POST /user-activities/search` and `datePosted` on `POST /checks/search` are
  accepted but return zero rows for valid dates.
- **Verify advanced filters live.** Validate these fields before including
  them in the search bar; one rejected leaf fails the whole OR search. Run
  `npm run test:api:filters` with a fresh token and fix or report any 400:
  - Invoices: `surcharge`, `registration`, `receivedBy.name`,
    `pickupEmployee.name`, `route.name`, `officeBranch.name`, `pickupSource`,
    `id`, `updatedBy.name`.
  - Barcodes: `route.name`, `delivery.name`, `tripNumber`, `barcodeId`.
    Barcode statuses: `prevStatus`.
  - Customers: `accountBalance`, `active`. Containers: `createdAt`,
    `updatedAt`, `createdBy.name`, `updatedBy.name`.
  - Employees: `updatedAt`, `startDate`, `endDate`, `totalLoanGiven`,
    `totalPaymentReceived`, `loanAmountOwed`, `user.name`. Users: `updatedAt`,
    `startTime`, `endTime`, `createdBy.name`, `updatedBy.name`. Roles:
    `systemRole`.
  - Branches: `id`, `createdAt`, `updatedAt`, `createdBy.name`,
    `updatedBy.name`. Vehicles: `createdAt`, `updatedAt`, `updatedBy.name`.
    Daily routes: `vehicle.name`.
  - Chart of accounts: `description`, `parentAccount.name`, `systemAccount`,
    `default`, `branchAccount`.
  - Checks, Zelle, deposits and credit cards: `updatedAt`, `clearedBy.name`,
    `invoice.balance`, `id`.
  - Loans: `description`, `referenceNumber`, `branch.name`. Journals:
    `description`. User activity: `activityId`, `quantity`.
  - Inventory receipts and dispatches: `lines.itemId`. Once verified, item names
    can join supplier and holder names in the receipt/dispatch search bar.
- **Visible columns the search endpoints do not accept.** These cannot be
  searched, filtered or sorted server-side. Add each one to the endpoint's filter
  and sort allow-lists (or provide a denormalized searchable field):
  - Customers: `notes`, `receivers`.
  - Invoices: `invoiceDetails` (merchandise descriptions), `itemCount`,
    `legacySyncedAt`, `branch.name`/`branch.code` (only `branch.id` is
    accepted).
  - Items (`/invoice-descriptions`): `createdBy.name`, `updatedBy.name`.
  - Containers: `barcodeSequence`, `deliverySequence`.
  - Employees: `loanBalanceUpdated`. `branch.name` is accepted, but employee
    records only carry `branch.code`; confirm which branch fields are
    persisted.
  - Roles: `permissions` (permission names).
  - Branches: `address.address1`, `address.country`, `settings.labelPrefix`,
    `disclaimer`.
  - Daily routes (`/vehicle-routes`): `createdAt`. The driver, supervisor and
    helper columns can only use `employees.name` with `employees.role` as
    separate leaves, which does not guarantee that both match the same crew
    member. Provide `driver.name`, `supervisor.name` and `helpers.name`
    filters and sorts (or element-match semantics), plus `vehicle.name` sort.
  - Loans: `paidAmount`, `balance`.
  - Journals (Daily Income, Pending financial activity, Pending clearance):
    `invoice.discount`, account type, `transactionBalance`, `currency`,
    `customer`, `loan`. Portal sorting is limited to `date` and `createdAt`
    pending an indexed sort allow-list. Requested: `invoice.number`,
    `refNumber`, `accounts.name`, `transactionAmount`, `invoice.balance`,
    `employee.name`, `transactionType`, `paymentMethod.name`,
    `createdBy.name`, `reconciliationStatus` and `clearanceStatus` (see
    journal query capacity above).
  - Inventory receipts, dispatches and items: supplier, warehouse/holder, item
    and assignee columns show names, but the API only filters by ids
    (`supplierId`, `toHolderId`, `fromHolderId`, `lines.itemId`). The portal
    matches names against the loaded catalogs and sends ids, so these columns
    cannot be sorted. Add name sort fields or denormalized names. Also add
    `postedAt` and `postedBy` (receipts/dispatches) and the stock quantity
    columns on items (quantity left, in warehouse, pending custody,
    quarantined) to filter and sort.
- **Reserved invoice sorting and response parity.** POST search returns a flat
  `data` array, incompatible with the Portal cursor-page schema. GET `sort=number:asc` and
  `sort=number:desc` returned identical ascending pages. Align the GET/search
  sort and cursor contract, document accepted fields, and preserve distinct
  `receivedAt` versus server-generated `reservedAt` semantics. See the
  [reserved search contract](reserved-invoice-search-api-contract.md).
- **Batch barcode lookup by invoice or barcode lists and ranges.** Barcode
  search must accept, in one request, a comma-separated list or range of
  invoice numbers, or a list or range of barcode numbers. Document the list
  operator (`in`) and inclusive range operators (`gte`/`lte`) on
  `invoice.number` and `number`, or provide a dedicated batch endpoint. Ranges
  must compare the numeric sequence, not the string, so `INV-26-001470` to
  `INV-26-001483` returns every invoice in between. Define the maximum batch
  size, keep tenant/branch scope, page the results and report which requested
  values matched nothing. Tracked for the portal in
  [portal planned features](verification-issues.md#planned-features).
- **Change requests have no search.** `GET /change-requests` documents no
  query parameters and there is no `/change-requests/search`, so the review list
  can only page by `createdAt:desc`. Add the standard search endpoint with
  documented filter and sort fields (status, type, requester, reviewer,
  created/reviewed dates).
- **Lookup-backed name search is capped.** Inventory directories resolve
  supplier, holder, item and assignee names from the first 200 lookup records,
  and send at most 25 matching ids per field. Larger catalogs need server-side
  name search (see the inventory name columns above).
- **Pending inventory dispatches.** The Pending transactions queue
  (`POST /inventory/pending-dispatches/search`) still uses fixed holder, date and
  age inputs, with no column sort or row selection. Document the accepted sort
  fields before the portal converts it to the shared directory table.

## Documentation and mock-data follow-up

- Exclude retained test stock, financial records and closeouts from meaningful
  reporting; resolve outstanding fixture follow-up in
  [mock-data-follow-up.md](mock-data-follow-up.md).
- Align the live reserved-invoice search response with the Portal's expected
  cursor-page envelope and verify cursor behavior; see the
  [reserved invoice search contract](reserved-invoice-search-api-contract.md).
- **Route Deliveries / Appointments: assigned-route scope.** Live searches
  reject `route.id gt ""` with 400 ObjectID validation. The Portal still uses that
  rejected empty-string comparison for Route Appointments and uses route name
  for Route Deliveries, so the backend's claimed populated-ID page fix is not
  present in this checkout. Adopt and document a populated-ID predicate, then
  cover unnamed routes, missing/null IDs and assigned-only permissions. See
  the [remaining verification findings](backend-gap-verification-2026-11-07.md).
- **Route Deliveries: search, sort and filter on every column.**
  `POST /deliveries/assigned-barcodes/search` must accept these filter fields,
  which are not in its accepted list: `route.rate` (number),
  `receiver.address.address1`, and `receiver.phones.number` (digits). Using them
  today returns a visible query error. Once accepted, the portal will add
  receiver address and phones to the search bar; they are kept out now because
  one rejected leaf fails the whole search. Allow-list these sort fields on GET
  and search: `number`, `invoice.number`, `invoice.balance`, `route.rate`,
  `name`, `container.name`, `route.name`, `sender.name`,
  `sender.phones.number`, `receiver.name`, `receiver.address.address1`,
  `receiver.address.city`, `receiver.phones.number`.
- **Route Appointments: search, sort and filter on every column.**
  `POST /pickups/search` must accept these filter
  fields, which are not in its accepted list: `completedBy.name` (only
  `completedBy.id` today), `legacySyncError`, `legacySyncedAt` (date), and
  `routeNumber` (number). Verify name search/filter/sort and snapshot backfill
  across legacy and unnamed routes. Allow-list these sort fields: `id`, `date`,
  `completed`, `createdAt`, `updatedAt`, `sender.phone1`, `sender.name`,
  `sender.address.address1`, `sender.address.city`, `sender.address.state`,
  `sender.address.zipcode`, `sector.name`, `createdBy.name`, `updatedBy.name`,
  `comments.description`, `branch.code`, `employee.name`, `route.name`,
  `completedAt`, `completedBy.name`, `purpose`, `routeNumber`,
  `legacySyncStatus`, `legacySyncError`, `legacySyncedAt`.
- **Low offline-invoice pool alerts.** Add push or persisted severe alerts
  for generators and for individual mobile users whose assigned pool is low,
  with per-user remaining counts and thresholds without N+1 reads. Fix the
  user-specific pool lookup: `userId=73` returned `lowThreshold: 10` while the
  requester's preference was 0.
- **Vehicle inspection/registration due alerts.** Add backend severe warnings
  for active vehicles whose inspection or registration is due within seven
  business-calendar days, including overdue dates, scoped to company/branch.
  Add both date fields to create/read/update OpenAPI schemas and support indexed
  `lte` searches; both date filters currently return 400 field-not-allowed.
  Replace the Portal's first-200-vehicle lookup with complete server-side due-date
  coverage, and resolve operator-local versus business-date evaluation.
- Update `GET /invoices/reserved/mine` OpenAPI to document self-service grants,
  own unclaimed reservations and the optional `deviceId` filter.
- Update `scripts/audit-api-table-columns.mjs` to read OpenAPI 3
  `components.schemas` (and retain Swagger 2 support if needed), then rerun the
  table coverage audit. This checkout still fails with a TypeError on absent
  `definitions`. A temporary OpenAPI-aware copy then detected barcode schema
  drift (`voidReason`, `voidedAt`, `voidedBy`); the reported tool fix is not
  present locally.
- Provide a supported invoice-lifecycle repair for retained mock initial-payment
  postings. INV-26-001482/001483 retain $0.02 combined cash/SALES postings; six
  invoice-owned entries also remain after their invoices were deleted. Repair
  through supported operations and exclude these fixtures from meaningful mock
  reporting until resolved:

  | Invoice | Journal requiring repair |
  | --- | --- |
  | INV-26-001476 (deleted) | `6aecbaae87c1d88ee1a3d670` |
  | INV-26-001477 (deleted) | `6aecbaaf87c1d88ee1a3d676` |
  | INV-26-001478 (deleted) | `6aecbab087c1d88ee1a3d67c` |
  | INV-26-001479 (deleted) | `6aecbab187c1d88ee1a3d682` |
  | INV-26-001480 (deleted) | `6aecbab287c1d88ee1a3d688` |
  | INV-26-001481 (deleted) | `6aecbab387c1d88ee1a3d68e` |
  | INV-26-001482 | `6aee1104d037620215133a67` |
  | INV-26-001483 | `6aee1105d037620215133a6d` |
