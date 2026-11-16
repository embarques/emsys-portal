# Directory searches, typed filters, sorting and query capacity

Standalone handoff. Restructured November 15, 2026; evidence remains dated
November 13–14, 2026. This edit adds no runtime verification or item closure.

Each ID uses **Issue → Expected result → Suggested action**, with actions split
into **API work**, **Database work**, and **Both — API and database together**.
API work covers commands, permissions, business rules and published contracts.
Database work covers persisted-state verification, indexes, seeds and migrations
where justified; verification does not automatically require a schema change.
Both covers atomicity, concurrency and acceptance across API and persisted state.
Portal work is explicitly assigned to portal owners rather than backend teams.

Scope: **B09, I07**. All requirements and acceptance steps needed for this packet
are included here; recipients do not need other portal files. Source observations
refer to API revision `4fdef23abcbaa89778d9ea6ca2d8f28b633cd270`.
Backend source paths are optional pointers in the recipient's own repository.
Endpoint paths are relative to `/v1`. Confirmed defects, unverified scenarios and
proposed designs are different states. Previously passing cases are regression
controls, not newly open defects. Use actual backend DTOs; proposed shapes below
are explicitly labeled and must be published before integration.

## B09 — Nine selected missing filter and sort capabilities

### Issue

**Confirmed unsupported selected capabilities.** All nine additions still
returned unsupported-field 400 in November 14 live controls, including both
posting-date sort directions. Invalid vehicle-date requests hit the same unsupported
field gate, so they do not prove date validation. Ordinary branch/container/vehicle
read adapters passed against new fixtures; those reads are not open defects.

The other 44 of the original 53 rejected candidates are outside the selected
contract, not pending or newly fixed. No selected main-search field is missing by
exact name from the reviewed allow-lists; operators, deployment and performance
still require operation-specific acceptance.

### Expected result

The selected contract separates main search, advanced filters and user sorts
for 51 table surfaces/resource groups.
Street address and city remain in Customers/Appointments/Invoices/Route Deliveries
main search. This section lists only capabilities that contract will use and
that remain absent from the reviewed API source allow-lists.

The exact field inventory identifies
**9 missing capabilities across 5 operations: 7 filters and 2 sorts**. No selected
main-search field is missing by exact name from its reviewed query allow-list;
that does not certify its operators, aliases, deployed support or performance.
Barcode status options are an options endpoint, not a server search operation.

Requests use `query.Request`: filter leaves `{field, operator, value}`, sort
entries `{field, direction}`, and `pagination: {page, limit}`. Implement these
fields in the server query layer, preserve tenant/branch/permission scope, and
publish the corresponding operators, sort directions and validation errors.
Do not add these fields to the general main-search OR group.

| Search endpoint | Filters to support | Sorts to support |
| --- | --- | --- |
| `/branches/search` | `settings.labelPrefix` | — |
| `/containers/search` | `barcodeSequence`, `deliverySequence` | — |
| `/inventory/dispatches/search` | `postedAt` | `postedAt` |
| `/inventory/receipts/search` | `postedAt` | `postedAt` |
| `/vehicles/search` | `inspectionDate`, `registrationDate` | — |

- Sequence filters must compare numbers without text coercion; preserve zero.
- Label-prefix filters use the stored setting and documented text operators.
- Vehicle due-date filters need documented calendar-date semantics and invalid-date
  rejection; do not treat them as arbitrary string or browser-timezone comparisons.
- Inventory posting-date filters/sorts must use persisted `postedAt`, preserve
  missing values on unposted documents and define deterministic sort ties. Do not
  substitute receipt, dispatch or creation dates for posting time.
- Verify representative non-production query plans/latency and suitable indexes;
  source allow-list publication alone is not implementation or performance proof.

The other **44 of the original 53 rejected candidates** are outside the selected
field sets. They are no longer required B09 implementation work under this
contract; this is a scope decision, not a claim they were fixed. The nine selected
capabilities and full desired field matrix are included here; no historical
53-candidate artifact is required to implement the selected scope.
Portal main-search alignment is now implemented locally for Branches, Vehicles,
Shipping containers and Supply items. Their existing advanced-filter controls
remain available; the nine missing backend capabilities are not enabled.

Use existing canonical fields where the selected contract does so: supplier
`companyName`, container `name` / `containerNumber`, and ID-based supplier/holder
filters. Do not add unsupported name aliases or per-row lookup workarounds.
Receipt/dispatch `notes` is already in the reviewed source allow-lists; validate
deployment before switching the portal's current status-only main search.

All selected field sets still require operation-specific acceptance: main-search
OR with advanced-filter AND, typed operators, sort directions/ties, pagination,
permissions, tenant/context changes and deployed parity. Loan search exclusions
remain publication work under B05. Local portal request controls do not establish
live backend support; this documentation pass changes no API source.

### Suggested action

#### API work

1. Add exactly the seven filters/two sorts in the table above to the five
   resource query implementations; do not expand the general main-search OR.
2. Publish operation-specific operators, validation errors, sort directions,
   defaults/ties, null/date handling and page semantics. Preserve typed zero/false,
   numeric sequences, stored label prefix and calendar due dates.
3. Intersect focused main-search OR with advanced-filter AND inside permissions,
   company/branch/assignment scope. Preserve cancellation and canonical aliases.
4. Keep the nine controls disabled in the portal until deployed support passes;
   no whole-directory or per-row lookup workaround is appropriate.

#### Database work

1. Verify actual persisted `postedAt` for receipt/dispatch filters/sorts,
   including missing/unposted rows; do not substitute another date.
2. Inspect candidate indexes and representative plans for the five operations.
   Source allow-list entries or index presence alone do not prove actual use,
   correct semantics or acceptable latency.

#### Both — API and database together

1. [ ] Implement the exact seven filters/two sorts listed above in the resource
   query layer. Preserve typed numbers/zero, dates/nulls, scope and cancellation;
   do not add advanced-only fields to the general main-search OR group.
2. [ ] For each operation, establish accepted/rejected field/operator/sort cases,
   main-search OR intersected with advanced AND, page boundaries/ties, missing
   values, phone/address aliases and exact scan behavior. Verify permissions and
   tenant/branch changes on actual HTTP requests.
3. [ ] Publish actual wire allow-lists, operators/errors and default/tie ordering.
   Record source implementation separately from served and persisted acceptance.
4. [ ] Supply query plans and representative before/after latency for the five
   changed operations; agree indexes/budgets with each owner before rollout.

## I07 — Representative query capacity and isolation

### Issue

**Unverified capacity.** No Mongo plan/load access was available. Source plan
and command-count tests were located but not executed. Small fixtures, shorter OR
lists and index presence cannot establish speed improvements or fleet-scale budgets.

### Expected result

Scoped queries meet agreed representative request/payload/latency budgets with
correct results, deterministic ties/pages and cancellation. Evidence records
actual plans, examined keys/documents, commands and HTTP request costs. Isolation
and financial correctness remain acceptance requirements under load.

### Suggested action

#### API work

1. Define approved volumes, selectivity, permissions/company/branch mix and
   concurrency; use existing budgets or agree explicit ones before claiming pass.
2. Measure actual table/mobile/pool request counts, payload and latency, including
   cancellation and concurrent context changes; preserve server pagination and
   avoid per-field queries, fleet downloads and N+1 lookups.

#### Database work

1. Run `internal/authz/route_policy_integration_test.go`,
   `TestRoutePolicyScopeAndQueryPlanIntegration`, delivery balance/assigned-list
   tests and invoice-pool/mobile plan fixtures in their guarded environments.
2. Capture explain plans, indexes actually used, examined keys/documents, returned
   rows and command counts. Measure deep pages and filter/sort ties on approved
   representative data before selecting index changes.

#### Both — API and database together

1. [ ] Define approved representative volumes, selectivity, tenant/branch/grant
   mix, concurrency and established request/payload/latency budgets. If no budget
   exists, agree one and record it rather than claiming an unspecified pass.
2. [ ] Run existing route-policy, delivery balance/list and invoice-pool/mobile
   plan/command-count assertions, then measure the representative workload.
3. [ ] Report examined keys/documents, returned rows, indexes actually used,
   database commands, HTTP requests/payload and latency distributions. Include
   cancellation, deep pages, filter/sort ties and concurrent context changes.
4. [ ] Compare baseline and final results on the same workload, document tradeoffs
   and preserve isolation/correctness. New indexes or fewer OR fields alone do
   not prove latency improvement or fewer HTTP requests.

Vehicle due-date filters support future alerts: 10 calendar days ahead, due today
and overdue, scoped by vehicle:view/company/branch, across sidebar/table/inbox.
The search work does not itself implement those alerts. Loan/reservation/approval
operators must be published with their own actual endpoint semantics; GET cursor
binding cannot be inferred from POST allow-lists.

## Embedded selected table contract

The following is the November 13 desired field matrix, not certification of
source or deployed support. Keep the nine additions above as the current B09
implementation scope; all selected fields still need operation-specific acceptance.

### Shared rules

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

### Field matrix

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

## Execution prerequisites and completion report

Use approved non-production fixtures. HTTP acceptance requires a real Firebase
JWT in `Authorization: Bearer <token>` plus `x-company-id: <authorized company>`.
Exercise the actual permissions and branch/assignment scope; direct service tests
and hidden UI controls do not prove HTTP enforcement. Preserve credentials and
personal data when preparing shared evidence.

For the reviewed database integration suites, use a disposable loopback MongoDB
replica set with `APP_ENV=codex`, `RUN_INTEGRATION_TESTS=true` and
`DATABASE_NAME=emsys_codex_test`. Inspect current fixture guards/cleanup and run
families serially. URI variables differ: journal/loan/change-request/route-policy
suites use `EMSYS_FINANCIAL_CONTROLS_TEST_URI`; delivery workflow/completion use
`EMSYS_WIZARD_MONGO_URI`; assigned invoice/pool use `EMSYS_INVOICE_SYNC_TEST_URI`;
customer deletion uses `EMSYS_CUSTOMER_DELETE_TEST_URI`; closeout/historical
reconciliation use `QUALITY_TEST_MONGO_URI` (closeout fixtures need empty branch/
settings collections); inventory posting uses `.env.codex` and `MONGO_URI` or
`MONGODB_URI` with its exact test-database guard. Insight timezone suites separately require `EMSYS_INSIGHT_TEST_URI`.
Use only the families relevant to this packet. Skipped tests must be reported. No backend suite was executed
in the portal source-review pass. External-service, retained-data and capacity
acceptance need their specifically authorized environments.

Return one Markdown report that includes the evidence itself, not dependencies
on portal files or inaccessible artifact links:

1. Original ID and scenario/variant, source commit, deployed revision/environment,
   execution date, database/server version and executed versus skipped tests.
2. Fixture setup, actor permissions, company/branch/assignment scope, exact request
   DTO/version/retry fields and sanitized request/response excerpts.
3. Expected versus actual outcome and pass/fail/blocked for every required case.
   Include persisted before/after values, dependent record counts, replay/race
   results, unchanged state after rejection and rollback/history evidence.
4. Fixes and regression results; distinguish local tests, deployed acceptance,
   schema publication and portal rollout. Include query plans/load/budgets where
   required rather than assuming a new index improves performance.
5. Remaining design questions with a concrete example and current source behavior.
   Ask the lead modeler before implementing an unresolved policy. Keep the ID open
   if required cases are failed, skipped or unresolved. A successful source test
   or publication check alone does not close persisted runtime acceptance.
