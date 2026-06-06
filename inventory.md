# EMSYS Portal — Source Project Manifest

Structured inventory of **embarques-web-app** (`emsys-portal`). Generated as a reference before making changes.

---

## 1. Project Overview

| Attribute    | Value                                            |
| ------------ | ------------------------------------------------ |
| Framework    | Next.js 16 (App Router)                          |
| UI           | React 19, Tailwind 4, Radix/shadcn               |
| State        | Redux Toolkit + redux-persist                    |
| Backend      | Firebase Auth + Firestore                        |
| Tables       | TanStack Table + Virtual                         |
| Forms        | react-hook-form + Zod                            |
| Maps         | @react-google-maps/api                           |
| i18n         | Custom (`en` / `es`) via `AppPreferencesContext` |
| Source files | ~421 `.ts`/`.tsx`                                |

**Top-level layout:**

```
app/           → 27 route/layout files
components/    → 198 .tsx files (15 domains)
hooks/         → 20 custom hooks
lib/           → 162 modules (services, display, i18n, labels, store, data)
contexts/      → 2 React contexts
types/         → 2 ambient type extensions
```

---

## 2. Routes

### 2.1 Layouts

| File                         | URL scope       | Export            | Key imports                                                             |
| ---------------------------- | --------------- | ----------------- | ----------------------------------------------------------------------- |
| `app/layout.tsx`             | All routes      | `RootLayout`      | `@/lib/store` (ReduxProvider), `@/components/PWAInstaller`, globals CSS |
| `app/(dashboard)/layout.tsx` | Dashboard shell | `DashboardLayout` | `WorkspaceShell`, `Sidebar`, `GoogleMapsProvider`, Firebase auth guard  |

### 2.2 Route registry (`lib/workspaceRoutes.ts`)

All dashboard paths that open as workspace tabs:

| Path                | Nav key         | Status                            |
| ------------------- | --------------- | --------------------------------- |
| `/dashboard`        | dashboard       | KPI page                          |
| `/clientes`         | clients         | Full CRUD                         |
| `/pickups`          | pickups         | Full CRUD + map                   |
| `/routes`           | routes          | Full CRUD                         |
| `/trucks`           | trucks          | Full CRUD                         |
| `/dispatch`         | dispatch        | Full CRUD                         |
| `/envios`           | containers      | **Redirect → `/invoices/furgon`** |
| `/invoices`         | invoices        | Full CRUD                         |
| `/invoices/items`   | items           | Full CRUD                         |
| `/invoices/furgon`  | furgon          | Containers (furgón)               |
| `/invoices/conduce` | conduce         | Full CRUD                         |
| `/delivery`         | deliveries      | Placeholder                       |
| `/package-manager`  | packages        | Placeholder                       |
| `/inventory`        | inventory       | Placeholder                       |
| `/income`           | dailyIncome     | Placeholder                       |
| `/accounts`         | chartOfAccounts | Placeholder                       |
| `/reports`          | reports         | Placeholder                       |
| `/users`            | users           | Full CRUD                         |
| `/roles`            | roles           | Placeholder                       |
| `/employees`        | employees       | Full CRUD                         |
| `/account-settings` | accountSettings | Placeholder                       |
| `/labels/manager`   | labelManager    | Label processing                  |
| `/labels/tracker`   | labelTracker    | Label tracking                    |
| `/labels/updater`   | labelUpdater    | Barcode scan updates              |

### 2.3 Pages by implementation tier

**Auth**

| Route | Component   | Data                                               |
| ----- | ----------- | -------------------------------------------------- |
| `/`   | `LoginPage` | Firebase `signInWithEmailAndPassword`, auth bypass |

**Fully implemented (service-backed CRUD tables)**

| Route               | Component          | Services                                                                                            |
| ------------------- | ------------------ | --------------------------------------------------------------------------------------------------- |
| `/dashboard`        | `DashboardPage`    | Auth + `@/lib/dashboard/dashboardKpiMetrics`                                                        |
| `/clientes`         | `ClientesPage`     | `clientCatalogService`, `clientLookupService`, `pickupsService` (types)                             |
| `/pickups`          | `PickupsPage`      | `pickupsService`, `routesService`, `dispatchesService`, `trucksService`                             |
| `/routes`           | `RoutesPage`       | `routesService`                                                                                     |
| `/trucks`           | `TrucksPage`       | `trucksService`                                                                                     |
| `/dispatch`         | `DispatchPage`     | `dispatchesService`, `trucksService`, `employeesService`                                            |
| `/invoices`         | `InvoicesPage`     | 8 parallel services (invoices, conduces, pickups, containers, dispatches, items, trucks, employees) |
| `/invoices/conduce` | `ConducePage`      | `conducesService`, `employeesService`, `containersService`                                          |
| `/invoices/furgon`  | `FurgonPage`       | `containersService`                                                                                 |
| `/invoices/items`   | `ItemsPage`        | `itemsService`                                                                                      |
| `/labels/manager`   | `LabelManagerPage` | invoices + conduces + containers + local label store                                                |
| `/labels/tracker`   | `LabelTrackerPage` | containers + `useLabelStore`                                                                        |
| `/labels/updater`   | `LabelUpdaterPage` | conduces, containers, employees + barcode scan                                                      |
| `/employees`        | `EmployeesPage`    | `employeesService`                                                                                  |
| `/users`            | `UsersPage`        | `usersService`                                                                                      |

**Placeholder (i18n title only)**

`/account-settings`, `/accounts`, `/delivery`, `/income`, `/inventory`, `/package-manager`, `/reports`, `/roles`

**Redirect**

`/envios` → `/invoices/furgon`

### 2.4 Page import details

#### `app/layout.tsx`

- **Export:** `RootLayout`
- **Imports:** `next` (Metadata, Viewport), `./globals.css`, `./shadcn.css`, `@/components/PWAInstaller`, `@/lib/store` (ReduxProvider)

#### `app/(dashboard)/layout.tsx`

- **Export:** `DashboardLayout`
- **Imports:** `WorkspaceShell`, `Sidebar`, `UtilityToolbarProvider`, `GoogleMapsProvider`, `DashboardContentInsetContext`, `AppPreferencesContext`, `getFirebaseAuth`, `isAuthBypassEnabled`, Firebase `onAuthStateChanged`

#### `app/page.tsx` — `/`

- **Export:** `LoginPage`
- **Imports:** `@/hooks/useTranslation`, `@/lib/firebaseConfig`, `@/lib/authBypass`, Firebase auth

#### `app/(dashboard)/dashboard/page.tsx`

- **Export:** `DashboardPage`
- **Components:** `DashboardEmployeeCharts`, `DashboardTotalContainersKpi`, `DashboardPendingPickupsKpi`, `DashboardTotalIncomeKpi`

#### `app/(dashboard)/clientes/page.tsx`

- **Export:** `ClientesPage`
- **Components:** `DataTable`, `ClienteAddModal`, `ClienteViewPanel`, `ClientesSelectionContextBar`, `ClientesColumnCustomize`, `ClientesFilterModal`, `ClientesUserActivityPanel`, `DashboardTableChrome`, `TableSelectionChromeActions`, `ThemedConfirmDialog`, `CopyFeedbackToast`, `TablePaginationFooter`
- **Services:** `clientCatalogService`, `clientLookupService`, `pickupsService`
- **Lib:** `mockClientesUserActivity`, `clientesTable`, `clientDataTableColumns`, `workspaceTabsSlice`, `clientsFilter`

#### `app/(dashboard)/pickups/page.tsx`

- **Export:** `PickupsPage`
- **Components:** pickups table/map/modals, `DashboardTableChrome`, selection chrome
- **Services:** `pickupsService`, `routesService`, `dispatchesService`, `trucksService`
- **Lib:** `pickupDisplay`, `pickupsFilter`, `pickupsPrintHtml`, `addressCoords`, `tableSelectionScope`

#### `app/(dashboard)/routes/page.tsx`

- **Export:** `RoutesPage`
- **Components:** `RoutesTable`, `RouteViewPanel`, `RouteAddPanel`, `RoutesSelectionContextBar`
- **Services:** `routesService`

#### `app/(dashboard)/trucks/page.tsx`

- **Export:** `TrucksPage`
- **Components:** `TrucksTable`, `TruckViewPanel`, `TruckAddPanel`, `TrucksSelectionContextBar`
- **Services:** `trucksService`

#### `app/(dashboard)/dispatch/page.tsx`

- **Export:** `DispatchPage`
- **Components:** `DispatchesTable`, `DispatchViewPanel`, `DispatchAddPanel`, `DispatchesSelectionContextBar`
- **Services:** `dispatchesService`, `trucksService`, `employeesService`

#### `app/(dashboard)/invoices/page.tsx`

- **Export:** `InvoicesPage`
- **Components:** `InvoicesTable`, `InvoicesFilterModal`, `InvoicesSelectionContextBar`
- **Services:** invoices, conduces, pickups, containers, dispatches, items, trucks, employees, clientCatalog

#### `app/(dashboard)/invoices/conduce/page.tsx`

- **Export:** `ConducePage`
- **Components:** `ConducesTable`, `ConduceViewPanel`, `ConduceAddPanel`, `ConducesSelectionContextBar`
- **Services:** `conducesService`, `employeesService`, `containersService`

#### `app/(dashboard)/invoices/furgon/page.tsx`

- **Export:** `FurgonPage`
- **Components:** `ContainersTable`, `ContainerViewPanel`, `ContainerAddPanel`, `ContainersSelectionContextBar`
- **Services:** `containersService`

#### `app/(dashboard)/invoices/items/page.tsx`

- **Export:** `ItemsPage`
- **Components:** `ItemsTable`, `ItemViewPanel`, `ItemAddPanel`, `ItemsSelectionContextBar`, `ItemsFilterModal`
- **Services:** `itemsService`

#### `app/(dashboard)/labels/manager/page.tsx`

- **Export:** `LabelManagerPage`
- **Components:** label manager workspace, processed tables, toolbars, bulk choice dialogs
- **Services:** invoices, conduces, containers + local label store

#### `app/(dashboard)/labels/tracker/page.tsx`

- **Export:** `LabelTrackerPage`
- **Components:** `LabelTrackerTable`
- **Services:** `containersService` + `useLabelStore`

#### `app/(dashboard)/labels/updater/page.tsx`

- **Export:** `LabelUpdaterPage`
- **Components:** `LabelUpdaterLogTable`
- **Services:** conduces, containers, employees + barcode scan

#### `app/(dashboard)/employees/page.tsx`

- **Export:** `EmployeesPage`
- **Components:** `EmployeesTable`, `EmployeeModal`
- **Services:** `employeesService`

#### `app/(dashboard)/users/page.tsx`

- **Export:** `UsersPage`
- **Components:** `UsersTable`, `UserModal`
- **Services:** `usersService`

#### `app/(dashboard)/envios/page.tsx`

- **Export:** `EnviosPage`
- **Behavior:** Client redirect to `/invoices/furgon`

### 2.5 Sidebar navigation (`components/Sidebar.tsx`)

Menu groups: Dashboard, Clients, Pickups (new/list/routes/trucks/dispatch), Invoices (new/list/items/furgón/conduce), Labels (manager/tracker/updater), Shipments (delivery/packages/inventory), Accounting (income/accounts), Reports, Settings (users/roles/employees/account-settings).

Workspace tab actions: `openRouteTab`, `openPickupNewTab`, `openInvoiceNewTab`.

---

## 3. Components (198 files)

### 3.1 Count by domain

| Domain        | Files | Role                                                |
| ------------- | ----: | --------------------------------------------------- |
| `pickups/`    |    36 | Pickup CRUD, map, line details, party/address UI    |
| `invoices/`   |    28 | Invoice editor/viewer, line items, payments, labels |
| `ui/`         |    24 | shadcn + classic form primitives                    |
| `clientes/`   |    16 | Client modal, address fields, activity panel        |
| `labels/`     |    14 | Label manager/tracker/updater UI                    |
| `shared/`     |    14 | Selection bars, address controls, search fields     |
| `routes/`     |    11 | Route CRUD, place lists                             |
| `containers/` |    10 | Furgón (container) CRUD                             |
| `dashboard/`  |     7 | KPI cards, employee charts                          |
| `items/`      |     6 | Invoice line-item catalog                           |
| `dispatches/` |     5 | Dispatch CRUD                                       |
| `trucks/`     |     5 | Truck CRUD                                          |
| `conduces/`   |     5 | Conduce (delivery slip) CRUD                        |
| `data-table/` |     4 | Generic table, columns, mobile cards                |
| `workspace/`  |     4 | Tab bar, shell, route host                          |
| Root + other  |    11 | Sidebar, PWA, employees, users, utility, providers  |

### 3.2 pickups/ (36 files)

| File                                  | Export                            | Props                                           |
| ------------------------------------- | --------------------------------- | ----------------------------------------------- |
| `PickupAddressStrip.tsx`              | `PickupAddressStrip`              | `PickupAddressStripProps`                       |
| `PickupAddressSummaryText.tsx`        | `PickupAddressSummaryText`        | inline                                          |
| `PickupAssignDispatchDialog.tsx`      | `PickupAssignDispatchDialog`      | `PickupAssignDispatchDialogProps`               |
| `PickupContactList.tsx`               | `PickupContactList`               | `PickupContactListProps`                        |
| `PickupLineComposerForm.tsx`          | `PickupLineComposerForm`          | `PickupLineComposerFormProps`                   |
| `PickupLineDetailComposerRow.tsx`     | `PickupLineDetailComposerRow`     | `PickupLineDetailComposerRowProps`              |
| `PickupLineDetailDisplayTableRow.tsx` | `PickupLineDetailDisplayTableRow` | `PickupLineDetailDisplayTableRowProps`          |
| `PickupLineDetailTableRow.tsx`        | `PickupLineDetailTableRow`        | `PickupLineDetailTableRowProps`                 |
| `PickupLineDetailText.tsx`            | `PickupLineDetailText`            | inline                                          |
| `PickupLineDetailsPillList.tsx`       | `PickupLineDetailsPillList`       | `PickupLineDetailsPillListProps`                |
| `PickupLineDetailsSection.tsx`        | `PickupLineDetailsSection`        | `PickupLineDetailsSectionProps`                 |
| `PickupMapAdvancedMarker.tsx`         | `PickupMapAdvancedMarker`         | `PickupMapAdvancedMarkerProps`                  |
| `PickupModal.tsx`                     | `PickupModal`                     | `PickupModalLogisticsLists`, `LineDetail`, etc. |
| `PickupPartyAddressControls.tsx`      | `PickupPartyAddressControls`      | `PickupPartyAddressControlsProps`               |
| `PickupPartyAddressSection.tsx`       | `PickupPartyAddressSection`       | `PickupPartyAddressSectionProps`                |
| `PickupPartyAddressSummaryRow.tsx`    | `PickupPartyAddressSummaryRow`    | inline                                          |
| `PickupPartyContactBar.tsx`           | `PickupPartyContactBar`           | `PickupPartyContactBarProps`                    |
| `PickupPartyContactInlineRow.tsx`     | `PickupPartyContactInlineRow`     | `PickupPartyContactInlineRowProps`              |
| `PickupPartySearchCard.tsx`           | `PickupPartySearchCard`           | `PickupPartySearchCardProps`                    |
| `PickupPartySenderContactSummary.tsx` | `PickupPartySenderContactSummary` | `PickupPartySenderContactSummaryProps`          |
| `PickupReceiverCard.tsx`              | `PickupReceiverCard`              | `PickupReceiverCardProps`                       |
| `PickupReceiverStack.tsx`             | `PickupReceiverStack`             | `PickupReceiverStackProps`                      |
| `PickupSenderAddressCard.tsx`         | `PickupSenderAddressCard`         | `PickupSenderAddressCardProps`                  |
| `PickupSenderAddressFields.tsx`       | `PickupSenderAddressFields`       | `PickupSenderAddressFieldsProps`                |
| `PickupSenderAddressFormCard.tsx`     | `PickupSenderAddressFormCard`     | `PickupSenderAddressFormCardProps`              |
| `PickupViewContent.tsx`               | `PickupViewContent`               | inline                                          |
| `PickupViewModal.tsx`                 | `PickupViewModal`                 | `PickupViewModalProps`                          |
| `PickupViewPanel.tsx`                 | `PickupViewPanel`                 | `PickupViewPanelProps`                          |
| `PickupsActionToolbar.tsx`            | `PickupsActionToolbar`            | `PickupsActionToolbarProps`                     |
| `PickupsColumnCustomize.tsx`          | `PickupsColumnCustomize`          | `PickupsColumnCustomizeProps`                   |
| `PickupsFilterModal.tsx`              | `PickupsFilterModal`              | `PickupsFilterModalProps`                       |
| `PickupsMap.tsx`                      | `PickupsMap`                      | non-exported `PickupsMapProps`                  |
| `PickupsSelectionContextBar.tsx`      | `PickupsSelectionContextBar`      | `PickupsSelectionContextBarProps`               |
| `PickupsSelectionFabColumn.tsx`       | `PickupsSelectionFabColumn`       | `PickupsSelectionFabColumnProps`                |
| `PickupsTable.tsx`                    | `PickupsTable`                    | `PickupsTableProps`                             |
| `Stepper.tsx`                         | `Stepper`                         | `StepperStep`                                   |

### 3.3 invoices/ (28 files)

| File                                | Export                          | Props                                |
| ----------------------------------- | ------------------------------- | ------------------------------------ |
| `InvoiceActivitySection.tsx`        | `InvoiceActivitySection`        | `InvoiceActivitySectionProps`        |
| `InvoiceAddPanel.tsx`               | `InvoiceAddPanel`               | `InvoiceAddPanelProps`               |
| `InvoiceAssignDeliveryDialog.tsx`   | `InvoiceAssignDeliveryDialog`   | `InvoiceAssignDeliveryDialogProps`   |
| `InvoiceCommentsSection.tsx`        | `InvoiceCommentsSection`        | `InvoiceCommentsSectionProps`        |
| `InvoiceDescriptionViewTabs.tsx`    | `InvoiceDescriptionViewTabs`    | `InvoiceDescriptionViewTabsProps`    |
| `InvoiceEditorFooter.tsx`           | `InvoiceEditorFooter`           | `InvoiceEditorFooterProps`           |
| `InvoiceFormPanel.tsx`              | `InvoiceFormPanel`              | `InvoiceFormPanelProps`              |
| `InvoiceFormTotalsFooter.tsx`       | `InvoiceFormTotalsFooter`       | `InvoiceFormTotalsFooterProps`       |
| `InvoiceHeaderBar.tsx`              | `InvoiceHeaderBar`              | `InvoiceHeaderBarProps`              |
| `InvoiceLabelStatusSection.tsx`     | `InvoiceLabelStatusSection`     | `InvoiceLabelStatusSectionProps`     |
| `InvoiceLabelTrackerSection.tsx`    | `InvoiceLabelTrackerSection`    | `InvoiceLabelTrackerSectionProps`    |
| `InvoiceLineDescriptionField.tsx`   | `InvoiceLineDescriptionField`   | `InvoiceLineDescriptionFieldProps`   |
| `InvoiceLineDescriptionSection.tsx` | `InvoiceLineDescriptionSection` | `InvoiceLineDescriptionSectionProps` |
| `InvoiceLineInlineField.tsx`        | `InvoiceLineInlineField`        | `InvoiceLineInlineFieldProps`        |
| `InvoiceLineItemTableRow.tsx`       | `InvoiceLineItemTableRow`       | `InvoiceLineItemTableRowProps`       |
| `InvoiceLineItemsSection.tsx`       | `InvoiceLineItemsSection`       | `InvoiceLineItemsSectionProps`       |
| `InvoicePartiesSection.tsx`         | `InvoicePartiesSection`         | `InvoicePartiesSectionProps`         |
| `InvoicePaymentsSection.tsx`        | `InvoicePaymentsSection`        | `InvoicePaymentsSectionProps`        |
| `InvoiceViewContent.tsx`            | `InvoiceViewContent`            | `InvoiceViewContentProps`            |
| `InvoiceViewLineItemsTable.tsx`     | `InvoiceViewLineItemsTable`     | `InvoiceViewLineItemsTableProps`     |
| `InvoiceViewPanel.tsx`              | `InvoiceViewPanel`              | `InvoiceViewPanelProps`              |
| `InvoiceViewPartiesSection.tsx`     | `InvoiceViewPartiesSection`     | `InvoiceViewPartiesSectionProps`     |
| `InvoiceWorkspaceEditor.tsx`        | `InvoiceWorkspaceEditor`        | `InvoiceWorkspaceEditorProps`        |
| `InvoiceWorkspaceViewer.tsx`        | `InvoiceWorkspaceViewer`        | `InvoiceWorkspaceViewerProps`        |
| `InvoicesFilterModal.tsx`           | `InvoicesFilterModal`           | `InvoicesFilterModalProps`           |
| `InvoicesSelectionContextBar.tsx`   | `InvoicesSelectionContextBar`   | `InvoicesSelectionContextBarProps`   |
| `InvoicesTable.tsx`                 | `InvoicesTable`                 | `InvoicesTableProps`                 |

### 3.4 Other component domains

**routes/** (11): `RouteAddPanel`, `RouteDetailModal`, `RouteFormContent`, `RouteFormModal`, `RouteFormPlaceChipList`, `RouteFormPlaceList`, `RouteViewPanel`, `RoutesSelectionContextBar`, `RoutesSelectionToolbar`, `RoutesTable`

**dispatches/** (5): `DispatchAddPanel`, `DispatchFormContent`, `DispatchViewPanel`, `DispatchesSelectionContextBar`, `DispatchesTable`

**containers/** (10): `ContainerAddPanel`, `ContainerFormContent`, `ContainerModal`, `ContainerViewContent`, `ContainerViewPanel`, `ContainersSelectionContextBar`, `ContainersSelectionFabColumn`, `ContainersSelectionToolbar`, `ContainersTable`

**trucks/** (5): `TruckAddPanel`, `TruckFormContent`, `TruckViewPanel`, `TrucksSelectionContextBar`, `TrucksTable`

**clientes/** (16): `ClientClassicAddressControl`, `ClientTypePill`, `ClientTypeSearchSelect`, `ClienteAddModal`, `ClienteClassicAddressFields`, `ClienteDetailsFormContent`, `ClienteViewPanel`, `ClientesColumnCustomize`, `ClientesFilterModal`, `ClientesSelectionContextBar`, `ClientesSelectionFabColumn`, `ClientesSelectionToolbar`, `ClientesUserActivityPanel`, `clienteFormDetailsLayout`

**labels/** (14): `LabelActionResultsTable`, `LabelBulkChoiceDialog`, `LabelManagerLineItemsTable`, `LabelManagerProcessedTable`, `LabelManagerSidePanel`, `LabelManagerWorkspacePanel`, `LabelProcessedToolbar`, `LabelProcessorFooter`, `LabelProcessorTabs`, `LabelProcessorToolbar`, `LabelTrackerTable`, `LabelUpdaterLogTable`, `ProcessedLabelsFilterModal`

**dashboard/** (7): `DashboardChartPeriodControl`, `DashboardEmployeeCharts`, `DashboardPendingPickupsKpi`, `DashboardPeriodKpiCard`, `DashboardTotalContainersKpi`, `DashboardTotalIncomeKpi`, `EmployeeRankedBarChart`

**shared/** (14): `AddressDropdownControls`, `AddressStepModeBar`, `AddressStrip`, `DashboardTableChrome`, `LineInlineCommandSelectField`, `LineInlineSearchSelectField`, `LogisticsClassicSearchField`, `PlaceAutocompleteSearchField`, `SearchCombobox`, `SelectionContextBar`, `SelectionScopeBanner`, `TableColumnCustomizeControl`, `TableEmptyState`, `TableSelectionChromeActions`

**ui/** (24): shadcn primitives + `ClassicFormField`, `ClassicFormSearchSelect`, `ClassicFormViewField`, `CopyFeedbackToast`, `DashboardModalHeader`, `DashboardWizardStepHost`, `FormResetFieldsButton`, `PartyContactActions`, `PartyContactFields`, `SearchableSelect`, `ThemedConfirmDialog`, `ToolbarNativeSelect`, `ToolbarSegmentedControl`, `TablePaginationFooter`, `WhatsAppIcon`

**workspace/** (4): `WorkspaceRoutePage`, `WorkspaceShell`, `WorkspaceTabBar`, `WorkspaceTabHost`

**conduces/** (5): `ConduceAddPanel`, `ConduceFormContent`, `ConduceViewPanel`, `ConducesSelectionContextBar`, `ConducesTable`

**items/** (6): `ItemAddPanel`, `ItemFormContent`, `ItemViewPanel`, `ItemsFilterModal`, `ItemsSelectionContextBar`, `ItemsTable`

**data-table/** (4): `columns`, `DataTable`, `DataTableColumnCustomize`, `DataTableMobileCards`

**Root + other** (11): `DashboardLayout`, `PWAInstaller`, `Sidebar`, `employees/EmployeeModal`, `employees/EmployeesTable`, `users/UserModal`, `users/UsersTable`, `utility/UtilityCalculator`, `utility/UtilityMemoPad`, `utility/UtilityToolbar`, `providers/GoogleMapsProvider`

### 3.5 Recurring component patterns

**Page shell cluster** (used by most CRUD pages):

- `@/components/shared/DashboardTableChrome`
- `@/components/shared/TableSelectionChromeActions`
- `@/components/ui/ThemedConfirmDialog`
- `@/components/ui/CopyFeedbackToast`
- `@/components/ui/TablePaginationFooter`
- `@/components/data-table/DataTableColumnCustomize`

**Panel/modal form cluster**:

- `@/components/ui/DashboardModalHeader`
- `@/components/ui/FormResetFieldsButton`
- Domain `*FormContent` + `use*FormState` hook
- `@/lib/focusFormField`

**Table cluster**:

- `@/components/data-table/DataTable`
- `@/lib/tableSelectionScope`
- Domain `*Table` + `*SelectionContextBar`

### 3.6 Workspace system

| Component            | Purpose                                   | Key imports                                                                             |
| -------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `WorkspaceShell`     | Tab chrome wrapper                        | `workspaceTabsSlice`, `WorkspaceTabBar`, `WorkspaceTabHost`                             |
| `WorkspaceTabBar`    | Tab strip UI                              | `useTranslation`                                                                        |
| `WorkspaceTabHost`   | Renders active tab content                | `PickupModal`, `InvoiceWorkspaceEditor`, `InvoiceWorkspaceViewer`, `WorkspaceRoutePage` |
| `WorkspaceRoutePage` | Lazy-loads all 25 dashboard pages by path | Direct `@/app/(dashboard)/**/page` imports                                              |

**Tab kinds** (`WorkspaceTabKind`): `route`, `client-view`, `client-new`, `client-edit`, `pickup-new`, `pickup-edit`, `invoice-new`, `invoice-edit`, `invoice-view`

---

## 4. Data Shapes

### 4.1 Core domain entities (Firestore-backed)

**`Pickup`** (`lib/services/pickupsService.ts`) — primary logistics entity:

```
id, comment, sender, receivers[], location, purpose, units, quantity,
status, scheduledDate, driverId, driverName, userName, branch, notes,
invoiceNumber, sector, route, dispatchId, createdAt, updatedAt
+ Partial<Client> (denormalized sender fields)
```

**`Client`** (same file):

```
clientId, clientType: 'sender'|'receiver', name, addresses[], whatsapp,
documentId, email, notes + primary address/contact denormalization
```

**`ClientAddress`**: `id, address1, apt?, address2?, country, city, state, zipCode?, lat?, lng?, googleMapsVerified?`

**`PickupReceiver`**: extends address book pattern with `selectedAddressId`, contact fields, `notes`

**`Invoice`** (`lib/services/invoicesService.ts`):

```
id, invoiceNumber, pickupId?, containerFurgon, date, pending: 'USA'|'RD',
dispatchId?, dispatchName?, sender, receiver, lineItems[], comments?,
payments?, total?, discount?, paid?, balance?, createdAt?, updatedAt?
```

**`InvoiceLineItem`**: `id, itemId?, description, quantity, labels, unitPrice?, total, labelsManual?, totalManual?`

**`InvoiceComment`**: `id, text, authorName, authorEmail?, createdAt?`

**`InvoicePayment`**: `id, description, quantity, method, date, referenceNumber, createdBy`

**`InvoicePartySnapshot`**: `clientId?, name, phone1?, phone2?, email?, documentId?, notes?, receiver?`

**`Container`**: `furgon, cost, containerNumber, booking, seal, broker, company, departureDate, arrivalDate, status: 'pending'|'in_transit'|'arrived'`

**`Conduce`**: `conduceNumber, date, employee1Id, employee2Id, employee3Id, employeeIds?, furgon`

**`Dispatch`**: `name, date, employeeIds[]`

**`RouteDefinition`**: `id, name, places: RoutePlace[]` where `RoutePlace = { kind: 'city'|'state'|'zip'|'zip_range', value }`

**`Truck`**: `name, vin, year, gasType: 'diesel'|'gas'|''`

**`Item`**: `description, price`

**`Employee`**: `sucursal: 'NY'|'RD'|'', departamento, titulo, firstName, lastName, phone, email, role, status: 'active'|'inactive', ...`

**`User`**: `username, firstName, email, companyId, role: 'admin'|'user', branch, status, language: 'es'|'en'`

### 4.2 Label domain (`lib/labels/labelTypes.ts`)

| Type                      | Key fields                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `PersistedLabelRecord`    | `barcode, invoiceId, lineItemId, labelDisplay, status, itemContainer, delivery, quantity` |
| `LabelStoreState`         | `version, byLineKey, nextBarcodeSeq` (localStorage)                                       |
| `LabelRecordStatus`       | pending, ready, printed, in_transit, delivered, hold, loaded, unloaded                    |
| `LabelUpdaterLogEntry`    | scan audit log                                                                            |
| `LabelManagerLineItemRow` | flattened invoice line for label generation                                               |
| `LabelActionResultRow`    | bulk action results                                                                       |

### 4.3 Redux state shapes

**`AppState`** (`appSlice`):

```
pageCache: { clientes, pickups, envios, invoices, delivery, inventory,
             income, accounts, reports, employees, users }
currentUser, sidebarCollapsed, openDropdowns[], viewMode: 'list'|'map'
```

**`WorkspaceTabsState`**: `tabs[], activeTabId, dismissedRoutePaths[]`

**`WorkspaceTab`**: `tabId, kind, label, routePath?, clientId?, clientSnapshot?, pickupId?, pickupSnapshot?, invoiceId?, invoiceSnapshot?, ...`

### 4.4 Mock / in-memory data

| Module                            | Storage               | Used by                         |
| --------------------------------- | --------------------- | ------------------------------- |
| `MOCK_CLIENTS`                    | In-memory catalog     | `clientCatalogService`          |
| `MOCK_PICKUPS`                    | Merged with Firestore | `pickupsService.getPickups()`   |
| `MOCK_INVOICES`                   | Merged with Firestore | `invoicesService.getInvoices()` |
| `MOCK_CLIENTES_USER_ACTIVITY_RAW` | Static demo           | Clientes activity panel         |
| `mockClientHistory`               | Static demo           | Client view panel               |
| Label store                       | localStorage          | Label manager/tracker/updater   |

### 4.5 Filter / form state types

| Type                         | Module                                |
| ---------------------------- | ------------------------------------- |
| `PickupsFilterState`         | `lib/pickupsFilter.ts`                |
| `InvoicesFilterState`        | `lib/invoiceListFilters.ts`           |
| `ProcessedLabelsFilterState` | `lib/labels/processedLabelFilters.ts` |
| `ClientsFilterState`         | `lib/clientsFilter.ts`                |
| `ItemsFilterState`           | `lib/itemsFilter.ts`                  |
| `TruckFormState`             | `hooks/useTruckFormState.ts`          |
| `DispatchFormState`          | `hooks/useDispatchFormState.ts`       |
| `ContainerFormState`         | `hooks/useContainerFormState.ts`      |
| `ItemFormState`              | `hooks/useItemFormState.ts`           |
| `ConduceFormState`           | `hooks/useConduceFormState.ts`        |
| `RouteFormState`             | `hooks/useRouteFormState.ts`          |
| Invoice form state           | `hooks/useInvoiceFormState.ts`        |

### 4.6 Supporting types

| Type                                                         | Module                                 |
| ------------------------------------------------------------ | -------------------------------------- |
| `Locale`                                                     | `lib/i18n/types.ts`                    |
| `PickupLineDetail`                                           | `lib/pickupLineDetailInlineEdit.ts`    |
| `PickupLineComposerValues`                                   | `lib/pickupLineComposerSchema.ts`      |
| `ClientPastInvoice`, `ClientPastPickup`, `ClientPastPayment` | `lib/data/mockClientHistory.ts`        |
| `ClientesUserActivityRow`                                    | `lib/data/mockClientesUserActivity.ts` |
| `DominicanCity`                                              | `lib/data/dominicanCities.ts`          |
| `DashboardKpiSnapshot`                                       | `lib/dashboard/dashboardKpiMetrics.ts` |
| `TableSelectionScope`                                        | `lib/tableSelectionScope.ts`           |

---

## 5. Services Layer (12 files)

| Service                | Firestore collection         | Mock merge?       |
| ---------------------- | ---------------------------- | ----------------- |
| `pickupsService`       | `pickups`                    | Yes               |
| `invoicesService`      | `invoices`                   | Yes               |
| `clientCatalogService` | In-memory only               | Seeded from mocks |
| `clientLookupService`  | Catalog search (150ms delay) | —                 |
| `containersService`    | `containers`                 | No                |
| `conducesService`      | `conduces`                   | No                |
| `dispatchesService`    | `dispatches`                 | No                |
| `routesService`        | `routes`                     | No                |
| `trucksService`        | `trucks`                     | No                |
| `itemsService`         | `items`                      | No                |
| `employeesService`     | `employees`                  | No                |
| `usersService`         | `users`                      | No                |

Each service exports: entity interface + `get*()` + `create*` + `update*` + `delete*`.

### Service function reference

**pickupsService**: `getPickups`, `createPickup`, `updatePickup`, `deletePickup`, `toggleComplete`

**invoicesService**: `getInvoices`, `createInvoice`, `updateInvoice`, `deleteInvoice`, `addInvoiceComment`

**clientCatalogService**: `getClientCatalogSnapshot`, `subscribeClientCatalog`, `upsertClient`, `removeClientsByIds`, `resetClientCatalogToMock`

**clientLookupService**: `searchClientsForClientesPage` (min 3 chars)

**routesService**: `getRoutes`, `createRoute`, `updateRoute`, `deleteRoute`, plus `routeMatchesSearch`, `formatRoutePlacesSummary`, `parseRouteZipRangeBounds`

**containersService**, **conducesService**, **dispatchesService**, **trucksService**, **itemsService**, **employeesService**, **usersService**: standard CRUD per entity

---

## 6. Hooks (20 files)

| Hook                            | Primary deps                                                         |
| ------------------------------- | -------------------------------------------------------------------- |
| `useTranslation`                | `AppPreferencesContext`, `@/lib/i18n/translate`                      |
| `useUserRole`                   | Firebase auth + Firestore                                            |
| `useLabelStore`                 | localStorage label persistence                                       |
| `useLabelTrackerUser`           | Firebase auth                                                        |
| `useInvoiceFormState`           | invoices, pickups, containers, items services + pickup receiver form |
| `useInvoiceLabelRecords`        | label store utils                                                    |
| `useInvoiceActivity`            | invoice activity log                                                 |
| `useInvoiceLabelTrackerUpdates` | label tracker updates                                                |
| `useDispatchFormState`          | dispatches service                                                   |
| `useConduceFormState`           | conduces service                                                     |
| `useContainerFormState`         | containers service                                                   |
| `useTruckFormState`             | trucks service                                                       |
| `useItemFormState`              | items service                                                        |
| `useRouteFormState`             | routes service                                                       |
| `useTableSelectionScope`        | table selection scope                                                |
| `useDataTableColumnPrefs`       | column preferences                                                   |
| `usePickupsTableColumnPrefs`    | pickup column prefs                                                  |
| `useColumnLabels`               | i18n column labels                                                   |
| `useMediaQuery`                 | responsive breakpoints                                               |
| `usePartyColumnsBalancedHeight` | invoice party layout                                                 |

---

## 7. Contexts

| Context                        | Exports                                                     | Purpose                              |
| ------------------------------ | ----------------------------------------------------------- | ------------------------------------ |
| `AppPreferencesContext`        | `AppPreferencesProvider`, `useAppPreferences`               | Locale (`en`/`es`), `t()` translator |
| `DashboardContentInsetContext` | `DashboardContentInsetProvider`, `useDashboardContentInset` | Fixed toolbar alignment insets       |

---

## 8. Lib Modules (non-service, grouped)

| Category            | Key modules                                                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Display/format**  | `pickupDisplay`, `invoiceDisplay`, `containerDisplay`, `conduceDisplay`, `dispatchDisplay`, `truckDisplay`, `itemDisplay`, `routePlaceDisplay` |
| **Form validation** | `invoiceFormValidation`, `pickupLineComposerSchema`, `addressRowUtils`, `pickupReceiverForm`                                                   |
| **Inline edit**     | `pickupLineDetailInlineEdit`, `invoiceLineItemInlineEdit`                                                                                      |
| **Address/geo**     | `clientAddresses`, `addressCoords`, `parseGooglePlace`, `googleMapsConfig`, `dominicanCities`                                                  |
| **Table infra**     | `clientesTable`, `pickupsTableColumns`, `tableSelectionScope`, `dataTableColumnChrome`, `tableEmptyState`                                      |
| **Labels**          | `labelPersistence`, `labelStoreUtils`, `labelPrintPdf`, `printSelectedLabels`, `labelUpdaterScan`, `labelTrackerUpdates`                       |
| **Dashboard**       | `dashboardKpiMetrics`, `employeeDashboardPeriods`, `employeeDashboardDummyData`                                                                |
| **i18n**            | `locales/en/*`, `locales/es/*`, `translate.ts`, `columnLabelKeys.ts`                                                                           |
| **Infra**           | `firebaseConfig`, `firebase`, `authBypass`, `firestoreSerialize`, `brandColors`, `utils.ts`                                                    |

---

## 9. Import Dependency Graph (high level)

```
app/(dashboard)/*/page.tsx
  ├── components/{domain}/*Table, *Panel, *SelectionContextBar
  ├── hooks/useTranslation, useTableSelectionScope, useDataTableColumnPrefs
  ├── lib/services/*Service
  ├── lib/store (appSlice pageCache, workspaceTabsSlice)
  └── lib/{domain}Display, *Filter, tableActionFeedback

components/workspace/WorkspaceTabHost
  ├── PickupModal, InvoiceWorkspaceEditor, InvoiceWorkspaceViewer
  ├── lib/services/* (prefill data)
  └── WorkspaceRoutePage → all page.tsx imports

components/pickups/PickupModal
  ├── pickupsService, clientCatalogService, invoicesService
  ├── clientes/ClienteAddModal
  └── shared/*, ui/*

lib/services/pickupsService
  ├── firebaseConfig, firestoreSerialize
  └── lib/data/mockPickups (merge)

lib/services/invoicesService
  ├── firebaseConfig, mockInvoices
  └── pickupsService (PickupReceiver type)

lib/store/store.ts
  ├── appSlice (persisted: viewMode, sidebarCollapsed, openDropdowns)
  └── workspaceTabsSlice (session-only)
```

---

## 10. External Dependencies (imports from npm)

| Package                                                                | Used for                         |
| ---------------------------------------------------------------------- | -------------------------------- |
| `next`                                                                 | App Router, navigation, metadata |
| `react` / `react-dom`                                                  | UI                               |
| `firebase`                                                             | Auth + Firestore                 |
| `@reduxjs/toolkit` / `react-redux` / `redux-persist`                   | Global state                     |
| `@tanstack/react-table` / `@tanstack/react-virtual`                    | Data tables                      |
| `@react-google-maps/api`                                               | Pickup map, place autocomplete   |
| `react-hook-form` / `@hookform/resolvers` / `zod`                      | Forms                            |
| `@radix-ui/*` / `cmdk`                                                 | UI primitives                    |
| `lucide-react`                                                         | Icons                            |
| `jspdf` / `jsbarcode`                                                  | Label PDF generation             |
| `tailwindcss` / `clsx` / `tailwind-merge` / `class-variance-authority` | Styling                          |

---

## 11. Implementation Status Summary

| Tier               | Routes                                                                                                      | Count |
| ------------------ | ----------------------------------------------------------------------------------------------------------- | ----: |
| Full CRUD + tables | pickups, routes, trucks, dispatch, invoices, conduce, furgón, items, clientes, employees, users, labels (3) |    15 |
| Dashboard/KPI      | dashboard                                                                                                   |     1 |
| Auth               | login                                                                                                       |     1 |
| Placeholder        | delivery, inventory, income, accounts, reports, roles, package-manager, account-settings                    |     8 |
| Redirect           | envios → furgón                                                                                             |     1 |

---

## 12. Firestore Collections Reference

| Collection   | Service             |
| ------------ | ------------------- |
| `pickups`    | `pickupsService`    |
| `invoices`   | `invoicesService`   |
| `containers` | `containersService` |
| `conduces`   | `conducesService`   |
| `dispatches` | `dispatchesService` |
| `routes`     | `routesService`     |
| `trucks`     | `trucksService`     |
| `items`      | `itemsService`      |
| `employees`  | `employeesService`  |
| `users`      | `usersService`      |

---

_Generated from source analysis. Update this file when routes, components, or data shapes change materially._
