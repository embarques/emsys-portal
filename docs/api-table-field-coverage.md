# API table field coverage

Source: `.reference/emsys-api/docs/swagger.json` (emsys-api reference clone) → `definitions` (Swagger 2) or `components.schemas` (OpenAPI 3). Regenerate and verify with `node scripts/audit-api-table-columns.mjs --write`.

The 26 table/catalog surfaces below cover 450 schema/compatibility fields. Metadata distinguishes existing columns, optional columns and intentionally omitted raw fields. Existing column layouts, storage keys and user preferences are preserved.

For fields with columns, nested values stay within their owning column and existing business renderers retain their formatting. Fields marked `column: false` are intentionally not copied into raw table display data; typed feature models/actions remain unchanged. Missing values display a dash; zero and false remain distinct. Response schema coverage never enables unsupported sorting.

| API definition | Table/catalog surface | Fields | Generated field candidates | Intentionally not columns |
| --- | --- | ---: | --- | --- |
| `barcode.Barcode` | [barcodes-workspace.tsx](../src/components/barcodes/barcodes-workspace.tsx) | 20 | `invoiceNumber`, `name` | `voidReason`, `voidedAt`, `voidedBy` |
| `barcodestatus.BarcodeStatus` | [barcode-statuses-workspace.tsx](../src/components/barcodes/barcode-statuses-workspace.tsx) | 3 | See existing/catalog columns | — |
| `branch.Branch` | [branches-workspace.tsx](../src/components/branches/branches-workspace.tsx) | 13 | `createdAt`, `createdBy`, `disclaimer`, `logo`, `settings`, `updatedAt`, `updatedBy` | — |
| `chartaccount.ChartAccount` | [chart-of-accounts-workspace.tsx](../src/components/accounting/chart-of-accounts-workspace.tsx) | 22 | `branchAccount`, `createdAt`, `createdBy`, `default`, `name`, `updatedAt`, `updatedBy` | `classification`, `code`, `codeRange`, `customizationPolicy`, `nonPosting`, `subType`, `templateLayer`, `templateVersion` |
| `check.Check` | [checks-workspace.tsx](../src/components/accounting/checks-workspace.tsx) | 16 | `clearedAt`, `id`, `journal`, `updatedAt`, `updatedBy` | `clearedBy`, `reversedAt` |
| `container.Container` | [containers-workspace.tsx](../src/components/containers/containers-workspace.tsx) | 20 | `createdBy`, `deliverySequence`, `updatedBy` | `receiverDocType`, `senderDocType` |
| `customer.Customer` | [customers-workspace.tsx](../src/components/customers/customers-workspace.tsx) | 17 | `active`, `branch`, `id`, `receivers` | `version` |
| `deposit.Deposit, zelle_payment.ZellePayment, credit_card_payment.CreditCardPayment` | [clearable-payments-workspace.tsx](../src/components/accounting/clearable-payments-workspace.tsx) | 15 | `clearedAt`, `id`, `journal`, `updatedAt`, `updatedBy` | `clearedBy`, `reversedAt` |
| `employee.Employee` | [employees-workspace.tsx](../src/components/employees/employees-workspace.tsx) | 21 | `address`, `createdBy`, `phones`, `updatedBy` | — |
| `employeedepartment.EmployeeDepartment` | [employee-departments-workspace.tsx](../src/components/employee-departments/employee-departments-workspace.tsx) | 6 | See existing/catalog columns | `translations` |
| `employeetitle.EmployeeTitle` | [employee-titles-workspace.tsx](../src/components/employee-titles/employee-titles-workspace.tsx) | 6 | See existing/catalog columns | `translations` |
| `inventory.Dispatch` | [inventory-dispatches-workspace.tsx](../src/components/inventory/inventory-dispatches-workspace.tsx) | 27 | `assigneeEmployeeId`, `correctsSourceId`, `dailyRouteId`, `id`, `notes`, `postedAt`, `postedBy`, `postingRevision`, `version` | `allowedActions`, `audit`, `confirmations`, `dailyRoute`, `incomeRecipients`, `lineProgress`, `pendingReconciliationCount`, `reconciliation`, `rejection`, `responsibleHolderIds`, `salesRecordedAtDispatch`, `submittedAt`, `submittedBy` |
| `inventory.Item` | [inventory-items-workspace.tsx](../src/components/inventory/inventory-items-workspace.tsx) | 11 | `currency`, `id`, `version` | `audit` |
| `inventory.Receipt` | [inventory-receipts-workspace.tsx](../src/components/inventory/inventory-receipts-workspace.tsx) | 20 | `correctsSourceId`, `id`, `notes`, `postedAt`, `postedBy`, `postingRevision`, `version` | `allowedActions`, `audit`, `confirmations`, `dailyRoute`, `dailyRouteId`, `rejection`, `submittedAt`, `submittedBy` |
| `inventory.Supplier` | [inventory-suppliers-workspace.tsx](../src/components/inventory/inventory-suppliers-workspace.tsx) | 7 | `id`, `version` | `audit` |
| `invoice.Invoice` | [invoices-workspace.tsx](../src/components/invoices/invoices-workspace.tsx) | 35 | `branch`, `id`, `isArchive`, `isVoid`, `legacySyncedAt`, `officeBranch`, `pickup`, `pickupEmployee`, `pickupSource`, `reservedAt`, `surcharge`, `updatedAt`, `updatedBy` | `version`, `dailyRoute`, `dailyRouteId` |
| `invoicedescription.InvoiceDescription` | [items-workspace.tsx](../src/components/items/items-workspace.tsx) | 5 | See existing/catalog columns | — |
| `journal.Journal` | [journal-transactions-table.tsx](../src/components/accounting/journal-transactions-table.tsx) | 80 | `reconciliationStatus`, `clearanceStatus`, `clearedAt`, `clearedBy`, `reconciledAt`, `reconciledBy`, `autoReconciled`, `accounts`, `checkNumber`, `createdAt`, `createdBy`, `currency`, `customer`, `date`, `description`, `duplicatePaymentOverride`, `employee`, `employeeGroup`, `external_reference_number`, `id`, `idempotencyKey`, `incomeStatement`, `invoice`, `loan`, `loanTransaction`, `paymentMethod`, `rate`, `refNumber`, `route`, `sourceBranchId`, `sourceBranchName`, `sourceCreatedBy`, `sourceCustomerId`, `sourceCustomerName`, `sourceId`, `sourceIncomeStatementId`, `sourceInvoiceId`, `sourceInvoiceNumber`, `sourceJournalIds`, `sourcePaymentMethodId`, `sourcePaymentType`, `sourceSupervisorId`, `sourceSupervisorName`, `sourceSystem`, `sourceTransactionNumber`, `sourceTransactionTypeId`, `transactionAmount`, `transactionBalance`, `transactionID`, `transactionType`, `updatedAt`, `updatedBy`, `vehicleRoute` | `allowedActions`, `pendingChange`, `restrictionReason`, `version`, `autoReconcile`, `reversalOf`, `reversedAt`, `reversedTransactionType`, `transactionStatus`, `voidedAt`, `branch`, `dailyRoute`, `dailyRouteId`, `paymentAccount`, `paymentReference`, `sourceAccount`, `inventoryDirection`, `inventoryDispatchId`, `inventoryHolders`, `inventoryItemId`, `inventoryQuantity`, `inventoryReceiptId`, `inventoryReconciliationId`, `inventorySupplierId`, `inventoryTotal`, `inventoryUnitPrice`, `inventoryWarehouseHolderId` |
| `pickup.Pickup` | [orders-workspace.tsx](../src/components/orders/orders-workspace.tsx) | 24 | `completedAt`, `completedBy`, `legacySyncError`, `legacySyncStatus`, `legacySyncedAt`, `purpose`, `routeNumber`, `updatedBy` | `dailyRoute`, `orderNumber`, `voidReason`, `voidedAt`, `voidedBy`, `receivers` |
| `report.ReportDefinition` | [reports-workspace.tsx](../src/components/reports/reports-workspace.tsx) | 12 | See existing/catalog columns | `enabled`, `sortOrder`, `createdAt`, `updatedAt` |
| `role.Role` | [roles-workspace.tsx](../src/components/roles/roles-workspace.tsx) | 9 | `active`, `systemRole`, `updatedBy` | — |
| `route.Route` | [route-manager-workspace.tsx](../src/components/route-manager/route-manager-workspace.tsx) | 9 | `id`, `updatedBy` | `vehicle` |
| `user.User` | [users-workspace.tsx](../src/components/users/users-workspace.tsx) | 13 | `createdBy`, `updatedBy` | — |
| `useractivity.Activity` | [user-activities-workspace.tsx](../src/components/user-activities/user-activities-workspace.tsx) | 10 | `activityId` | `barcodeRouteChange` |
| `vehicle_route.VehicleRoute` | [pickup-delivery-routes-directory-workspace.tsx](../src/components/pickup-delivery-routes/pickup-delivery-routes-directory-workspace.tsx) | 14 | `active`, `employees`, `rate`, `tripNumber` | — |
| `vehicle.Vehicle` | [vehicles-workspace.tsx](../src/components/vehicles/vehicles-workspace.tsx) | 15 | `id`, `updatedBy`, `vehicleId` | — |

## Field aliases and scope

- Feature-owned `table-fields.ts` files map API names to existing UI column IDs (for example, invoice `number` → `invoiceNumber`, `payment` → `amountPaid`).
- Per APP_CONTEXT.md, invoice `receivedBy`, legacy `employee`, and legacy `route` share the existing **Received by** column; container `seal` and `sealNumber` share **Seal number**. These are intentional business aliases.
- Version/permission/command fields and raw inventory workflow objects use `column: false`; their typed feature models/actions remain authoritative. This documents coverage without generating new raw columns or duplicating money/account renderers.
- Employee title/department translation maps are deliberately not directory columns; the canonical API name is displayed.
- Reports is a generation hub, not a saved-report directory. Output formats are consumed by its PDF/Excel controls. Catalog enabled/sort/timestamp metadata remains in the adapter, without adding raw report rows or changing the hub flow.
- Shared clearable-payment metadata is checked against Deposit, ZellePayment and CreditCardPayment independently, rather than assuming check.Check is interchangeable.
- Compatibility field `check.Check.checkNumber`: Paper check compatibility alias; distinct from internal refNumber.
- Compatibility field `journal.Journal.checkNumber`: Existing paper check renderer/adapter compatibility alias.
- Compatibility field `pickup.Pickup.routeNumber`: Legacy route sequence; do not substitute the distinct orderNumber.
- Compatibility field `route.Route.vehicle`: Retired crew field is deliberately column:false for historical compatibility.
- The Loans table is not yet connected to schema coverage; the reference `loan.Loan` definition is available for that follow-up.
- Request DTOs, response envelopes, nested references, analytics responses, lookup-only resources, card/form views, and contextual invoice/route detail tables are not separate directory tables. This audit does not create directories for them or expand compact detail tables.
- Nested legacy credentials (`password`, `accessCode`, tokens, secrets) are excluded from captured display data.
