# Table search, filter and sort contracts

Defined November 13, 2026. Portal main-search alignment is implemented locally for
Branches, Vehicles, Shipping containers and Supply items; see the
[implementation evidence](backend-gap-local-handoff-2026-11-13.md#portal-main-search-alignment).
Other rows remain proposed; no backend search/filter/sort behavior changed.

These are separate product contracts for each table. Exact wire fields and static
[backend source comparisons](table-search-contracts-2026-11-13.json) are recorded separately
from the [53 previously rejected candidates](backend-gap-search-source-review-2026-11-13.json).
The API checkout remains read-only. Nothing here certifies deployed support or performance.

## Shared rules

- **Main search:** a focused OR across the listed identity/contact/operational text fields.
  Combine it with advanced filters using AND; never widen permission or route scopes.
- **Advanced filters:** main-search fields plus the additional fields in the third column.
  A column being visible does not automatically make it searchable, filterable or sortable.
- **Sorts:** only the independent list in the last column; append the existing resource
  identity as a deterministic tie-breaker. Directions are asc/desc subject to each
  endpoint's verified contract. Preserve current default ordering. Sort fields
  need not all be exposed as filters. Do not sort arrays/objects by formatted text.
- Missing/zero values, numeric amounts, dates, statuses and booleans keep their typed
  meanings. Do not stringify every field into a general text search.
- Keep one server-paginated query per active table search/page. Never query each field
  separately, fetch a whole directory or perform per-row lookups for search.
- Preserve existing invoice comma-separated number matching, phone normalization,
  scope/permission gates and cancellation. Use exact barcode matching for full scanned
  identities; bounded partial number lookup must remain an explicitly supported contract.
- The address decision is confirmed: street and city stay in main search for Customers,
  Appointments, Invoices and Route Deliveries. Search secondary/legacy addresses or phone
  shapes through existing feature aliases where needed, without substituting unrelated fields.
- Empty main search means **filter-led**: no new general search bar is proposed for that
  surface. It does not authorize removing an existing control. Existing workflow tables
  that expose only filters retain that pattern.

## Field matrix

Fields are canonical API names, not necessarily the UI labels. Extra filters are
additive to main fields. `—` means no main bar or no extra fields/sorts proposed.
These are initial desired sets, not the entire backend allow-list.

### Operations

| Table | Main search | Additional advanced filters | User sorts |
| --- | --- | --- | --- |
| Customers | `name`, `email`, `IDNumber`, `phones.number`, `phone1`, `phone2`, `addresses.address1`, `addresses.city` | `customerType`, `active`, `branch.id`, `accountBalance`, `addresses.state`, `addresses.zipcode`, `createdAt`, `createdBy.id`, `updatedAt` | `name`, `createdAt`, `updatedAt`, `accountBalance` |
| Appointments and Route Appointments | `orderNumber`, `sender.name`, `receivers.name`, `sender.phones.number`, `receivers.phones.number`, `sender.address.address1`, `sender.address.city`, `receivers.address.address1`, `receivers.address.city` | `date`, `completed`, `purpose`, `route.id`, `employee.id`, `branch.id`, `sector.id`, `legacySyncStatus`, `completedAt`, `createdAt` | `date`, `orderNumber`, `completed`, `createdAt` |
| Invoices | `number`, `sender.name`, `receiver.name`, `sender.phones.number`, `receiver.phones.number`, `sender.address.address1`, `sender.address.city`, `receiver.address.address1`, `receiver.address.city` | `date`, `registration`, `branch.id`, `container.id`, `dailyRoute.id`, `employee.id`, `receivedBy.type`, `cost`, `discount`, `payment`, `balance`, `paidStatus`, `isVoid`, `isArchive`, `createdAt` | `number`, `date`, `createdAt`, `balance`, `cost` |
| Reserved invoice numbers | `number` | `allocation.userId`, `claimed`, `createdAt`, `reservedAt`, `receivedAt` | `number`, `createdAt`, `reservedAt`, `receivedAt` |
| Barcodes | `number`, `invoice.number`, `description` | `status.id`, `container.id`, `route.id`, `delivery.id`, `scanDate`, `createdAt`, `updatedAt`, `createdBy.id` | `number`, `invoice.number`, `createdAt`, `scanDate` |
| Route Deliveries | `number`, `invoice.number`, `name`, `sender.name`, `receiver.name`, `sender.phones.number`, `receiver.phones.number`, `receiver.address.address1`, `receiver.address.city` | `route.id`, `delivery.id`, `container.name`, `receiver.address.state`, `invoice.balance`, `route.rate` | `number`, `invoice.number`, `receiver.address.city`, `receiver.address.state`, `receiver.name` |
| Shipping containers | `name`, `containerNumber`, `booking`, `sealNumber`, `itn` | `company`, `broker`, `cost`, `departureDate`, `arrivalDate`, `barcodeSequence`, `deliverySequence`, `createdAt` | `name`, `containerNumber`, `departureDate`, `arrivalDate`, `cost`, `createdAt` |
| Daily delivery/pickup routes | `name`, `vehicle.name`, `employees.name` | `date`, `routeType`, `branch.id`, `vehicle.id`, `employees.id`, `employees.roles`, `active`, `container.id`, `rate` | `name`, `date`, `branch.code`, `vehicle.name`, `routeType` |
| Reusable route crews | `employees.name` | `branch.id`, `employees.id`, `createdAt`, `createdBy.id`, `updatedAt` | `branch.code`, `createdAt`, `updatedAt` |
| Predefined route templates | `name` | `content`, `createdAt`, `updatedAt` | `name`, `createdAt`, `updatedAt` |
| Merchandise item shortcuts | `name` | `price`, `createdAt`, `updatedAt` | `name`, `price`, `createdAt`, `updatedAt` |

### People and administration

| Table | Main search | Additional advanced filters | User sorts |
| --- | --- | --- | --- |
| Employees | `name`, `email`, `phones.number` | `title`, `department`, `active`, `branch.id`, `startDate`, `endDate`, `totalLoanGiven`, `totalPaymentReceived`, `loanAmountOwed`, `cost`, `createdAt` | `name`, `startDate`, `department`, `title`, `loanAmountOwed`, `createdAt` |
| Employee titles | `name`, `translations.en`, `translations.es` | `active`, `createdAt`, `updatedAt` | `name`, `createdAt`, `updatedAt` |
| Employee departments | `name`, `translations.en`, `translations.es` | `active`, `createdAt`, `updatedAt` | `name`, `createdAt`, `updatedAt` |
| Users | `name`, `email` | `active`, `role.id`, `branch.id`, `uid`, `startTime`, `endTime`, `createdAt` | `name`, `email`, `createdAt`, `updatedAt` |
| Roles | `name` | `active`, `systemRole`, `createdAt`, `updatedAt`, `createdBy.id` | `name`, `createdAt`, `updatedAt` |
| Branches | `name`, `code` | `type`, `phones.number`, `address.city`, `address.state`, `address.zipcode`, `settings.labelPrefix`, `createdAt` | `name`, `code`, `type`, `createdAt` |
| Vehicles | `vehicleId`, `name`, `licensePlate`, `vin` | `year`, `fuelType`, `branch.id`, `active`, `inspectionDate`, `registrationDate`, `createdAt` | `vehicleId`, `name`, `licensePlate`, `year`, `createdAt` |
| Invoice policies | `title` | `body`, `active`, `sortOrder`, `createdAt`, `updatedAt` | `title`, `sortOrder`, `createdAt`, `updatedAt` |
| Memo pads | `name`, `content` | `createdAt`, `updatedAt`, `createdBy.id`, `updatedBy.id` | `name`, `createdAt`, `updatedAt` |
| Barcode status catalog | `name` | — | — |
| User Activity | `description`, `user.name`, `documentId` | `origin`, `eventType`, `severity`, `timestamp`, `user.id`, `quantity`, `barcodeRouteChange.previous.id` | `timestamp`, `user.name`, `origin`, `severity` |
| Protected change requests | `resourceId`, `requestedBy.name` | `resourceType`, `action`, `status`, `createdAt`, `reviewedAt`, `requestedBy.id`, `reviewedBy.id` | `createdAt`, `reviewedAt`, `status`, `resourceType` |

### Accounting

| Table | Main search | Additional advanced filters | User sorts |
| --- | --- | --- | --- |
| Chart of accounts | `displayName`, `name`, `code` | `type`, `description`, `branch.id`, `parentAccount.id`, `systemAccount`, `default`, `nonPosting`, `templateLayer`, `classification`, `subType` | `code`, `displayName`, `name`, `type`, `createdAt` |
| Loans | `employee.name`, `referenceNumber`, `description` | `employee.id`, `branch.id`, `loanAccount.id`, `status`, `principalAmount`, `openedAt`, `lastActivityAt` | `employee.name`, `principalAmount`, `openedAt`, `lastActivityAt`, `createdAt` |
| Daily Income journals and pending reconciliation/clearance | `refNumber`, `paymentReference`, `external_reference_number`, `invoice.number`, `description` | `date`, `branch.id`, `incomeStatement.id`, `employee.id`, `accounts.name`, `transactionType`, `paymentMethod.name`, `transactionAmount`, `reconciliationStatus`, `clearanceStatus`, `transactionStatus`, `createdBy.id`, `createdAt` | `date`, `createdAt`, `transactionAmount`, `invoice.number`, `refNumber` |
| Closeout history | — | `businessDate`, `date`, `status`, `branch.id`, `currency`, `automated`, `periodStart`, `periodEnd` | `businessDate`, `date`, `createdAt`, `status` |
| Checks | `checkNumber`, `refNumber`, `invoice.number` | `datePosted`, `paymentAmount`, `status`, `clearedAt`, `clearedBy.name`, `invoice.balance`, `createdBy.id` | `datePosted`, `checkNumber`, `refNumber`, `paymentAmount`, `createdAt`, `clearedAt` |
| Deposits | `paymentReference`, `refNumber`, `invoice.number` | `datePosted`, `paymentAmount`, `status`, `clearedAt`, `clearedBy.name`, `invoice.balance`, `createdBy.id` | `datePosted`, `paymentReference`, `refNumber`, `paymentAmount`, `createdAt`, `clearedAt` |
| Zelle payments | `paymentReference`, `refNumber`, `invoice.number` | `datePosted`, `paymentAmount`, `status`, `clearedAt`, `clearedBy.name`, `invoice.balance`, `createdBy.id` | `datePosted`, `paymentReference`, `refNumber`, `paymentAmount`, `createdAt`, `clearedAt` |
| Credit-card receipts | `paymentReference`, `refNumber`, `invoice.number` | `datePosted`, `paymentAmount`, `status`, `clearedAt`, `clearedBy.name`, `invoice.balance`, `createdBy.id` | `datePosted`, `paymentReference`, `refNumber`, `paymentAmount`, `createdAt`, `clearedAt` |

### Inventory

| Table | Main search | Additional advanced filters | User sorts |
| --- | --- | --- | --- |
| Supply items | `name`, `sku` | `category`, `unitOfMeasure`, `currency`, `defaultSellingPriceMinor`, `isActive`, `reorderThreshold`, `audit.createdAt` | `name`, `sku`, `category`, `defaultSellingPriceMinor`, `audit.createdAt` |
| Supply suppliers | `companyName` | `contacts.name`, `contacts.email`, `contacts.phone`, `isActive`, `audit.createdAt` | `companyName`, `audit.createdAt` |
| Holders / Recipients | `displayName` | `type`, `entityId`, `isActive` | `displayName`, `type` |
| Stock balances | — | `itemId`, `holderId`, `condition`, `quantityOnHand`, `quantityReserved`, `updatedAt` | `quantityOnHand`, `quantityReserved`, `updatedAt` |
| Supply receipts | `notes` | `supplierId`, `toHolderId`, `receivedAt`, `status`, `lines.itemId`, `dailyRouteId`, `audit.createdAt`, `postedAt` | `receivedAt`, `audit.createdAt`, `postedAt` |
| Supply dispatches | `notes` | `fromHolderId`, `toHolderId`, `responsibleHolderIds`, `dispatchedAt`, `status`, `lines.itemId`, `dailyRouteId`, `audit.createdAt`, `postedAt` | `dispatchedAt`, `audit.createdAt`, `postedAt` |
| Pending supply reconciliation | — | `holder.id`, `dailyRoute.id`, `dailyRoute.supervisor.id`, `dispatchedAt`, `ageDays`, `outstandingQuantity`, `pendingReconciliationCount` | `dispatchedAt`, `ageDays`, `outstandingQuantity` |

### Inventory workflow

| Table | Main search | Additional advanced filters | User sorts |
| --- | --- | --- | --- |
| Returns | — | `id`, `assignmentId`, `dailyRouteId`, `fromHolderId`, `toWarehouseHolderId`, `returnedAt`, `status`, `lines.itemId` | `returnedAt`, `id` |
| Dispositions | — | `id`, `assignmentId`, `holderId`, `dailyRouteId`, `closeoutId`, `type`, `occurredAt`, `status`, `lines.itemId` | `occurredAt`, `id` |
| Counts | — | `id`, `holderId`, `businessDate`, `status`, `lines.itemId` | `businessDate`, `id` |
| Adjustments | `reason` | `id`, `holderId`, `dailyRouteId`, `occurredAt`, `status`, `lines.itemId`, `correctsSourceId` | `occurredAt`, `id` |
| Supply sales reports | — | `id`, `assignmentId`, `dailyRouteId`, `holderId`, `closeoutId`, `businessDate`, `status`, `lines.itemId` | `businessDate`, `id` |
| Supply payments | — | `id`, `method`, `status`, `amountMinor`, `collectedByEmployeeId`, `collectedAt`, `dailyRouteId`, `inventoryDispatchId`, `inventoryReconciliationId` | `collectedAt`, `amountMinor`, `id` |
| Cash handovers | — | `id`, `fromEmployeeId`, `toEmployeeId`, `method`, `amountMinor`, `status`, `handedAt`, `receivedAt` | `handedAt`, `receivedAt`, `amountMinor`, `id` |
| Collection obligations | — | `id`, `responsibleEmployeeId`, `closeoutId`, `kind`, `amountMinor`, `settledMinor`, `status` | `amountMinor`, `settledMinor`, `id` |
| Supply closeouts | — | `id`, `holderId`, `accountableEmployeeId`, `dailyRouteId`, `businessDate`, `status`, `revision`, `needsReconciliation` | `businessDate`, `revision`, `id` |
| Supply route crews | `name` | `id`, `isActive` | `name`, `id` |
| Supply daily routes | — | `id`, `businessDate`, `vehicleId`, `crewId`, `members.employeeId` | `businessDate`, `id` |
| Supply audit events | — | `id`, `entityType`, `entityId`, `actorId`, `action`, `at`, `correlationId` | `at`, `id` |
| Supply journal entries | — | `id`, `sourceType`, `sourceId`, `postedAt`, `postingRevision`, `lines.accountId` | `postedAt`, `postingRevision`, `id` |

## Backend blockers and implementation boundaries

The JSON records source-declared query fields and `notDeclaredByExactName` for
each proposed set. A missing entry is a contract blocker, not permission to send
it anyway. Presence is only source evidence; alias expansion, supported operators,
sorting semantics and live deployment must still be verified.

- **Inventory receipt/dispatch notes:** source now includes `notes`; current portal
  search constants still say it is unsupported and search status instead. Validate
  deployment before updating these stale comments or switching the search bar.
- **Inventory postedAt:** API dev supports this explicit filter and sort for receipts and
  dispatches. Enable the controls after authenticated deployment acceptance.
- **Vehicle due dates and branch labelPrefix:** API dev supports these as advanced filters.
  Portal enablement awaits deployed verification, as do the numeric container
  sequence filters.
- **Route Deliveries name:** currently projects merchandise description into `name`.
  Keep this endpoint-specific field separate from barcode catalog `description`.
- **Supplier names:** use existing `companyName`, not an invented `name` alias.
  Receipt/dispatch supplier and holder filters use IDs until server name-query support
  is designed. Display names do not authorize directory scans or N+1 lookups.
- **Check number:** use `checkNumber`; generic payment directories use `paymentReference`.
  Preserve internal `refNumber` as a distinct field.
- **User Activity entity reference:** source uses `documentId`; do not assume the legacy
  portal `id` alias means the activity primary key or is valid on this operation.
- **Assign invoices:** current POST allow-list does not establish GET cursor-sort
  binding. Keep reserved date/null/device-claim semantics and test both envelopes.
- **Status options:** the main `name` match is an options-picker/local catalog concept;
  do not invent POST search or server sorting for `/barcodes/status-options`.
- **Routes/trips and piece identity:** use existing wire identities during compatibility
  rollout. The separately agreed company-unique immutable barcode and daily-route=trip
  target do not authorize switching IDs in current endpoints.

## Other surfaces and contextual tables

- Daily Income, pending reconciliation, pending clearance and pending financial activity
  reuse the journal field contract with their own mandatory queue predicates and permissions.
  Closeout navigation/history uses typed date/branch/status filters, not broad text search.
- Inventory workflow versions of holders/items/suppliers/stock/receipts/dispatches reuse
  the corresponding inventory contract above; this does not add missing UI controls.
- Supply reporting tables (stock valuation, sales, obligations and discrepancies) stay
  filter-led through their published report parameters. No new text search or arbitrary
  server sort is asserted for aggregation reports. Their exact support needs a report-contract
  pass before adding sortable columns. Reports/PDF generation is not a saved-report directory.
- Invoice details, attachments, payment history, loan transactions, label scan output,
  map results and selection pickers remain scoped child views; a parent-table contract
  does not add independent requests or remove current local controls.
- Redirects `/appointment-routes`, `/delivery-routes` and `/pickup-routes` do not define
  separate search contracts. Dashboard/analytics/settings are not general directories.

## Matching, operators and validation before implementation

1. Use exact/reference equality for IDs, booleans and enums; numeric equality/ranges
   for amounts; explicit date/range operators for calendar fields and timestamps.
   Main text matching may use contains/prefix only on documented text paths.
2. Do not use generic `contains` for numeric technical IDs, dates or money. Do not add
   an arbitrary minimum length to scanner or complete-reference lookups. Preserve current
   behavior until each matching strategy is validated; no new token syntax is proposed.
3. Keep the existing 300 ms shared catalog debounce; verify other table hooks separately.
   Reuse scoped TanStack Query caches and honor Axios cancellation. Use API limits; do not
   introduce polling or a second request system. Fewer OR fields reduces query complexity,
   not automatically HTTP request count.
4. Compare before/after request counts, examined documents/keys and latency on representative
   non-production records. An index or smaller field list alone is not performance evidence.
5. Test main-search OR combined with explicit AND filters; phone/address aliases; exact scans;
   comma-separated invoice matching; pagination/sort ties; permissions/context changes;
   rejected unsupported fields; cancellation; and unchanged default ordering/layout.

This is a definition/review artifact. No search field has been removed, no API gap
has been closed, and no source/runtime tests or performance benchmarks were run for it.
