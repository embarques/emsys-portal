# API table field coverage

Source: `api-docs.json` → `definitions`. Regenerate and verify with `node scripts/audit-api-table-columns.mjs --write`.

The 25 directory and catalog tables below cover 349 documented top-level response fields. Added columns are visible by default. Each configurable table starts a new saved layout; subsequent user visibility, order, and width choices persist.

Nested objects and arrays are displayed within their owning field column. Existing business columns retain their custom formatting. Missing API values display a dash; zero and false remain visible. Added response fields do not enable sorting unless the table already supports the field.

| API definition | Table | Fields | Added API field columns |
| --- | --- | ---: | --- |
| `barcode.Barcode` | [barcodes-workspace.tsx](../src/components/barcodes/barcodes-workspace.tsx) | 17 | `invoiceNumber`, `name` |
| `barcodestatus.BarcodeStatus` | [barcode-statuses-workspace.tsx](../src/components/barcodes/barcode-statuses-workspace.tsx) | 3 | See existing/catalog columns |
| `branch.Branch` | [branches-workspace.tsx](../src/components/branches/branches-workspace.tsx) | 13 | `createdAt`, `createdBy`, `disclaimer`, `logo`, `settings`, `updatedAt`, `updatedBy` |
| `chartaccount.ChartAccount` | [chart-of-accounts-workspace.tsx](../src/components/accounting/chart-of-accounts-workspace.tsx) | 14 | `branchAccount`, `createdAt`, `createdBy`, `default`, `name`, `updatedAt`, `updatedBy` |
| `check.Check` | [checks-workspace.tsx](../src/components/accounting/checks-workspace.tsx) | 13 | `clearedAt`, `id`, `journal`, `updatedAt`, `updatedBy` |
| `container.Container` | [containers-workspace.tsx](../src/components/containers/containers-workspace.tsx) | 18 | `createdBy`, `deliverySequence`, `updatedBy` |
| `customer.Customer` | [customers-workspace.tsx](../src/components/customers/customers-workspace.tsx) | 16 | `active`, `addresses`, `branch`, `id`, `phones`, `receivers` |
| `employee.Employee` | [employees-workspace.tsx](../src/components/employees/employees-workspace.tsx) | 21 | `address`, `createdBy`, `phones`, `updatedBy` |
| `employeedepartment.EmployeeDepartment` | [employee-departments-workspace.tsx](../src/components/employee-departments/employee-departments-workspace.tsx) | 5 | See existing/catalog columns |
| `employeetitle.EmployeeTitle` | [employee-titles-workspace.tsx](../src/components/employee-titles/employee-titles-workspace.tsx) | 5 | See existing/catalog columns |
| `inventory.Dispatch` | [inventory-dispatches-workspace.tsx](../src/components/inventory/inventory-dispatches-workspace.tsx) | 12 | `createdAt`, `createdBy`, `id`, `itemId`, `journal`, `updatedAt`, `updatedBy` |
| `inventory.Item` | [inventory-items-workspace.tsx](../src/components/inventory/inventory-items-workspace.tsx) | 9 | `averageCost`, `createdAt`, `createdBy`, `id`, `updatedAt`, `updatedBy` |
| `inventory.Receipt` | [inventory-receipts-workspace.tsx](../src/components/inventory/inventory-receipts-workspace.tsx) | 13 | `createdAt`, `createdBy`, `id`, `itemId`, `journal`, `supplierId`, `updatedAt`, `updatedBy` |
| `inventory.Supplier` | [inventory-suppliers-workspace.tsx](../src/components/inventory/inventory-suppliers-workspace.tsx) | 10 | `createdAt`, `createdBy`, `id`, `updatedAt`, `updatedBy` |
| `invoice.Invoice` | [invoices-workspace.tsx](../src/components/invoices/invoices-workspace.tsx) | 30 | `branch`, `id`, `invoiceDetails`, `isArchive`, `isVoid`, `legacySyncedAt`, `officeBranch`, `pickup`, `pickupEmployee`, `pickupSource`, `registration`, `surcharge`, `updatedAt`, `updatedBy` |
| `invoicedescription.InvoiceDescription` | [items-workspace.tsx](../src/components/items/items-workspace.tsx) | 5 | See existing/catalog columns |
| `journal.Journal` | [daily-income-workspace.tsx](../src/components/accounting/daily-income-workspace.tsx) | 46 | `accounts`, `checkNumber`, `createdAt`, `createdBy`, `currency`, `customer`, `description`, `duplicatePaymentOverride`, `employeeGroup`, `external_reference_number`, `id`, `idempotencyKey`, `incomeStatement`, `loan`, `loanTransaction`, `rate`, `route`, `sourceBranchId`, `sourceBranchName`, `sourceCreatedBy`, `sourceCustomerId`, `sourceCustomerName`, `sourceId`, `sourceIncomeStatementId`, `sourceInvoiceId`, `sourceInvoiceNumber`, `sourceJournalIds`, `sourcePaymentMethodId`, `sourcePaymentType`, `sourceSupervisorId`, `sourceSupervisorName`, `sourceSystem`, `sourceTransactionNumber`, `sourceTransactionTypeId`, `transactionBalance`, `transactionID`, `updatedAt`, `updatedBy`, `vehicleRoute` |
| `pickup.Pickup` | [orders-workspace.tsx](../src/components/orders/orders-workspace.tsx) | 19 | `completedAt`, `completedBy`, `id`, `legacySyncError`, `legacySyncStatus`, `legacySyncedAt`, `purpose`, `receivers`, `routeNumber`, `updatedBy` |
| `report.ReportDefinition` | [reports-workspace.tsx](../src/components/reports/reports-workspace.tsx) | 11 | See existing/catalog columns |
| `role.Role` | [roles-workspace.tsx](../src/components/roles/roles-workspace.tsx) | 9 | `active`, `systemRole`, `updatedBy` |
| `route.Route` | [route-manager-workspace.tsx](../src/components/route-manager/route-manager-workspace.tsx) | 10 | `id`, `updatedBy`, `vehicle` |
| `user.User` | [users-workspace.tsx](../src/components/users/users-workspace.tsx) | 13 | `createdBy`, `updatedBy` |
| `useractivity.Activity` | [user-activities-workspace.tsx](../src/components/user-activities/user-activities-workspace.tsx) | 8 | `activityId` |
| `vehicle_route.VehicleRoute` | [pickup-delivery-routes-directory-workspace.tsx](../src/components/pickup-delivery-routes/pickup-delivery-routes-directory-workspace.tsx) | 16 | `active`, `dayOfWeek`, `employees`, `rate`, `tripNumber`, `type` |
| `vehicle.Vehicle` | [vehicles-workspace.tsx](../src/components/vehicles/vehicles-workspace.tsx) | 13 | `id`, `updatedBy`, `vehicleId` |

## Field aliases and scope

- Feature-owned `table-fields.ts` files map API names to existing UI column IDs (for example, invoice `number` → `invoiceNumber`, `payment` → `amountPaid`).
- Per APP_CONTEXT.md, invoice `receivedBy`, legacy `employee`, and legacy `route` share the existing **Received by** column; container `seal` and `sealNumber` share **Seal number**. These are intentional business aliases.
- Employee title/department catalogs gained created/updated timestamps; barcode statuses gained ID; report definitions gained ID, key, icon, enabled, sort order, filters, and timestamps.
- Loans have a table but no loan record definition in this API snapshot, so field completeness cannot be established from this file.
- Request DTOs, response envelopes, nested references, analytics responses, lookup-only resources, card/form views, and contextual invoice/route detail tables are not separate directory tables. This audit does not create directories for them or expand compact detail tables.
- Nested legacy credentials (`password`, `accessCode`, tokens, secrets) are excluded from captured display data.
