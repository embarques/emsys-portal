# Backend/API gaps — pending work

Unresolved defects, contract decisions and acceptance work, updated November 7,
2026. API shapes are defined in [api-docs.json](../api-docs.json).

## Confirmed remaining defects

- **Historical reconciliation/filter coverage is still incomplete in this tenant.**
  Before mutation fixtures, PAYMENT search returned 24,132 rows; adding
  `OUTSTANDING` returned 3, and `RECONCILED` returned 0. The oldest sampled
  PAYMENT has an empty status.
  Journal `6aee1319d037620215133a92` reads as `OUTSTANDING` but disappears
  when that status is added to its exact-ID search. Confirm backfill deployment
  and execution, review ambiguous rows and verify safe reruns
  and unchanged invoice balances. See [financial controls](financial-controls.md).

- **Normally created zero-cost invoices cannot complete delivery.** A fixture
  requested with cost/discount/payment/balance all zero reads back without those
  financial fields and completion returns 409. Preserve authoritative zero values
  without weakening fail-closed handling for genuinely unknown balances.

- **Temporary customer deletion fails.** `DELETE /customers/{id}` returns 500
  for the two test customers despite current version headers. Resolve deletion
  through the supported lifecycle; the inactive fixtures and identifiers are in
  [mock-data follow-up](mock-data-follow-up.md).

## Pending verification and contract decisions

- **Daily-route assignment edge cases.** Verify concurrent completion, broader
  mixed/ineligible batches, scoped permissions, business-midnight rollover and
  unfinished barcode movement/removal from old routes. Publish unfinished
  barcode route-removal semantics explicitly.

- **Valid cash-account selection and account safeguards.** Provide a persisted
  CASH ON HAND hierarchy and a valid posting child in the mock company. The
  fresh bounded cash lookup still finds only orphan ASSET 4, Cash Account, which
  cannot establish chosen-account posting/readback. Verify create/sync/update,
  INITIAL-PAYMENT selection, cash expenses, inactive and tenant/branch scope,
  BANK deletion/type protection,
  parent validation, cycles and cash/bank report roll-ups.
  See [payment accounts](payment-accounts-api-contract.md).

- **Assigned-only invoice edge cases.** Verify ownership/customer negatives,
  revoked assignments and races, replay after deletion, initial-payment effects
  and the portal entry point. Clarify why `canOperateDailyRoute` activates a
  protected-record 403 on assigned creation. Resolve branch-association 400s in
  custom-code branch 11 and generic 400s for explicit `receivedBy` variants;
  distinguish branch/payload requirements from missing permissions.
  See [assigned invoices](assigned-invoice-api-contract.md).

- **Remaining delivery balance cases.** Resolve the zero-cost defect above;
  verify negative, unavailable/invalid balances, uncleared receipts, concurrent
  invoice changes, photo ownership, policy-negative cases and assigned-only crews.
  Preserve the no-override contract.
  See [delivery completion](delivery-completion-api-contract.md).

- **Permission combinations and refresh behavior.** Verify inventory journal
  `autoReconcile`, broader permission combinations and tenant/branch isolation.
  A role update returned 200 and exposed the new reconciliation grant through `/users/permissions`, but the command still
  returned 403 with the same token. Establish cache TTL/refresh/re-login behavior.
  See [reconciliation permissions](financial-controls.md).

- **Inventory edge cases and payment-method parity.** Verify broader failure
  atomicity, races, valuation and reopen revisions. WIRE and DEBIT-CARD each return
  422 `unknown accounting payment method`; the inventory enum excludes both.
  Decide this separate contract explicitly.
  See [inventory workflows](inventory-workflow.md).

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

## Documentation and mock-data follow-up

- Exclude retained test stock, financial records and closeouts from meaningful
  reporting; resolve outstanding fixture follow-up in
  [mock-data-follow-up.md](mock-data-follow-up.md).
- Add reserved-invoice column search with nested AND/OR filters and cursor
  pagination. The frontend assumes this pending endpoint; see
  [reserved invoice search contract](reserved-invoice-search-api-contract.md).
- **Route Deliveries: assigned-route scope.** Route Deliveries must list only
  barcodes on a delivery route, but `GET /deliveries/assigned-barcodes` returns
  every pending CONDUCE piece for `canViewDelivery`. The portal now always calls
  `/deliveries/assigned-barcodes/search` with `route.name gt ""` ANDed in, which
  relies on undocumented semantics (`gt ""` matching only non-empty strings and
  excluding missing/null routes). Verify that behavior, or provide a supported
  filter (for example `route.id` with an exists/`neq null` operator) or a
  default/flag that scopes the endpoint to routed barcodes. Route Appointments
  uses the same approach: `POST /pickups/search` always includes
  `route.id gt ""` (live pickups expose `route: { id }` without a name), so
  `canViewPickup` users only see pickups on a scheduled route. Verify the same
  semantics there, including if `route.id` is stored as an ObjectID.
- **Route Deliveries: search, sort and filter on every column.** The portal
  assumes every column is sortable and offers an advanced filter per column.
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
- **Route Appointments: search, sort and filter on every column.** The search
  bar now also covers `route.name`, `employee.name`, `sector.name`,
  `branch.code`, `branch.name`, `createdBy.name`, `updatedBy.name`, `purpose`
  and `legacySyncStatus`. `POST /pickups/search` must accept these filter
  fields, which are not in its accepted list: `completedBy.name` (only
  `completedBy.id` today), `legacySyncError`, `legacySyncedAt` (date), and
  `routeNumber` (number). `route.name` is accepted, but live pickups expose
  only `route: { id }`, so name search/filter/sort needs the name stored or
  resolved server-side. Allow-list these sort fields: `id`, `date`,
  `completed`, `createdAt`, `updatedAt`, `sender.phone1`, `sender.name`,
  `sender.address.address1`, `sender.address.city`, `sender.address.state`,
  `sender.address.zipcode`, `sector.name`, `createdBy.name`, `updatedBy.name`,
  `comments.description`, `branch.code`, `employee.name`, `route.name`,
  `completedAt`, `completedBy.name`, `purpose`, `routeNumber`,
  `legacySyncStatus`, `legacySyncError`, `legacySyncedAt`.
- **Low offline-invoice pool alerts.** The portal now warns users with
  `canGenerateInvoicePool` (topbar notification and Reserved invoices banner)
  when `GET /invoices/reserved?userId=0` reports `remaining <= lowThreshold`,
  using the requester's own threshold preference. It only sees this while the
  portal is open. Push or persisted severe notifications to generators, and
  alerts when an individual mobile user's assigned pool falls below that user's
  threshold, need backend support (per-user remaining plus threshold, without
  N+1 reads).
- **Vehicle inspection/registration due alerts.** Send a severe warning when a
  vehicle's `inspectionDate` or `registrationDate` is 7 days or fewer from
  today (`date - today <= 7`, including dates already past), evaluated on the
  business date. The portal now warns users with Vehicles access (topbar
  notification, Vehicles banner and highlighted date cells) for active
  vehicles, using the operator's local calendar day. It only sees this while
  the portal is open, and only checks the first 200 vehicles because
  `POST /vehicles/search` does not accept `inspectionDate`/`registrationDate`
  filters. Neither field appears in the `vehicle.Vehicle` OpenAPI schema;
  confirm both are persisted and returned as `YYYY-MM-DD` (or RFC3339) dates.
  Needs backend support for push or persisted severe notifications to users
  who manage vehicles, scoped to company/branch, plus `lte` filtering on both
  dates so the portal can list due/overdue vehicles without loading the fleet.
- Update `GET /invoices/reserved/mine` OpenAPI to document self-service grants,
  own unclaimed reservations and the optional `deviceId` filter.
- Update `scripts/audit-api-table-columns.mjs` to read OpenAPI 3
  `components.schemas` (and retain Swagger 2 support if needed), then rerun the
  table coverage audit. The current run fails with a TypeError because it reads
  the absent `definitions` field.
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
