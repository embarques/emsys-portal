# EMSYS App Context

Domain reference for AI agents and developers. Read this before changing copy, navigation, data models, or user flows.

`AGENTS.md` / `CURSOR_RULES.md` own **how** the frontend is built. This file owns **what the product is for**.

---

## Company Management System

EMSYS is designed for a door-to-door shipping and logistics company. We pick up merchandise directly from our clients’ locations or receive merchandise at our warehouse, then organize, manage, and ship it to the final destination specified by the client.

The system manages the entire operational process—from scheduling a pickup, receiving and digitizing merchandise, tracking individual items, organizing routes, and loading containers, to managing payments, accounting, employees, vehicles, and business insights.

---

## Critical distinctions

Do not mix these concepts. They look similar in code but mean different things in the business.

| Term | Means | Does **not** mean |
| --- | --- | --- |
| **Appointments** | A scheduled client visit (pickup, supplies, payment collection, or estimate) | A shipment, invoice, or delivery by itself |
| **Invoices** | Digitized records of **customer merchandise** collected as part of a shipment | Typical SaaS billing invoices, or company supply stock |
| **Items** | Optional predefined merchandise shortcuts used when creating invoices | Inventory SKUs or barcode labels |
| **Barcodes** | Labels that identify and track **individual pieces** of merchandise on an invoice | Inventory barcodes for company supplies |
| **Inventory** | The company’s **internal supplies and materials** | Customer merchandise / shipments |
| **Containers** | Shipping containers that group customer invoices/merchandise for transport | Inventory storage bins |
| **Routes** | Day-to-day organization of appointment stops and delivery stops | Accounting or inventory movement history |

**Code aliases (legacy names still in the repo):**

- Appointments often live under `orders` (`src/lib/orders`, `OrdersWorkspace`, `/appointments`)
- Barcode Scanner lives at `/label-updater` (`LabelUpdaterWorkspace`)
- Today’s Routes (dated daily-route setup) lives at `/daily-routes` (pickup-delivery-routes components; `/appointment-routes` and `/delivery-routes` redirect here)

---

## Operational flow

```txt
Client schedules a visit
  → Appointment
    → Pickup / receive merchandise
      → Invoice (digitized shipment record)
        → Barcodes on individual items
          → Routes / Containers move the merchandise
            → Accounting records payments
              → Insights reports on operations and finance
```

Customers are associated with both appointments and invoices so the company has a full history of visits and shipments.

---

## Sidebar sections

### Appointments

Appointments are created when a client contacts us and schedules a visit for a specific purpose (pickup, taking supplies for future packaging, collecting payment, or giving them an estimate).

Each appointment stores structured comments (`purpose`, `unit`, `quantity`, `description`). The printed pickup manifest (`POST /reports/pickups`) is rendered by the backend from those fields.

TODO (backend): make pickup-manifest comment lines readable for drivers. Today the PDF dumps raw field values in ALL CAPS, e.g. `OTHER PICKUP RECOGER 1 CAJA; OTHER TAKE LLEVAR 2 CAJAS`.

- Do not prefix a comment with the raw `OTHER` keyword when the item type is custom/other
- Use human purpose labels (Pickup, Take, Payment, Estimate, Other), not API enums
- Sentence-case the line; do not uppercase the whole dump
- Format from structured fields: purpose + quantity + unit (e.g. `Pickup 1 box`), and keep the user’s custom note as the readable text
- Put each comment on its own line (or separate with ` · `), not a semicolon-joined blob
- Do not concatenate `unit` + `purpose` + `description` when that repeats the same information

### Invoices

Invoices represent the merchandise that we receive from or pick up from our clients.

Our workers digitize the information from our physical invoices into the system so we can:

- Manage invoice information
- Record the items associated with each invoice
- Track merchandise
- Associate invoices with customers and appointments
- Track the status and movement of merchandise
- Maintain historical records

An invoice represents the merchandise collected as part of a client's shipment.

**Received by** (`receivedBy`) is who took in the merchandise. It replaces legacy `employee` (`core.User`). The value is either the selected **non-DR daily route** or a **single employee from a non-DR branch**, defined when creating or editing the invoice. The invoice table shows Received by, not a separate Route field. **Received via** (route / warehouse / office) is portal-only so the form can pick which of those to save; do not persist it.

TODO (backend) — invoice `receivedBy` (portal now follows this; align API + legacy data):

Replace invoice **`employee`** (`core.User`) with **`receivedBy`**.

**Route:** `receivedBy` is the selected daily vehicle-route (`id` + `name`) with nested crew ref `route` (`id` + `name`), or a single employee (like the current/legacy system).

Keep **`createdBy`** as the user who digitized the invoice. **`createdAt`** is the date/time the invoice was digitized. **`updatedAt` / `updatedBy`** are the last user who updated it.

**Backfill legacy invoices:** if `employee` is a `core.User` and there is no daily route, copy it onto `receivedBy`. After backfill, stop treating `employee` as Received by. The portal already reads `receivedBy` first and falls back to legacy `employee` / `route` until this ships.

### Reserved invoice numbers

Invoices → Reserved manages backend-generated numbers for offline mobile creation.
Unused numbers may be in the company pool, assigned to a user, or claimed
by a mobile installation. Downloaded numbers must be returned from that device
before reassignment. They are excluded from customer invoice lists and financial
totals. See the API contract `docs/contracts/reserved-invoice-pools.md` in emsys-api.
Pool view, generation and assignment have separate explicit permissions.
The directory uses the shared column filter builder for Invoice number, Received
at, User, and Status with AND/OR joins. Received at is a separate API timestamp
and displays a dash until supplied; it does not fall back to generation or
assignment time. Advanced search awaits the backend endpoint in
[the reserved invoice search contract](docs/reserved-invoice-search-api-contract.md).

### Barcodes

Barcodes identify and track **individual pieces of merchandise on an invoice**.

**Creation source of truth:** barcodes are created when an **invoice is digitized** with line items and a **labels** count. The API creates those labels on the invoice (`invoiceDetails.barcodes`). Do not create, edit structure, or delete barcodes from the Barcodes table — manage those through the invoice.

```txt
Invoice (line items + labels count)
  → Barcodes created on the invoice
    → Barcode Scanner: scan number → update status / container / route
    → Barcodes table: browse / filter / print / bulk status·container·route
```

**Surfaces (same labels, different jobs):**

| Surface | Role |
| --- | --- |
| **Barcode Scanner** | Operations: find a label by printed number and update location fields |
| **Barcodes table** | Browse / filter / print / bulk status·container·route (no standalone create/delete) |

Lookups and updates should prefer **invoice-embedded** barcodes when the number lives on an invoice. The `/barcodes` catalog may mirror or denormalize the same labels for directory search and reports; keep both stores in sync when the portal updates status, container, or route.

Barcode **route** is the **DR branch daily vehicle-route**, separate from invoice `receivedBy`. The barcode Route filter uses only **Equals** against `route.id`, with a dropdown of DR daily routes.

Barcode **status** is a manual location flag in the logistics process (where the piece is now), not an automatic workflow stage. Workers assign it via the scanner or Barcodes table. Status options come from the tenant `barcode_statuses` collection via `GET /v1/barcodes/status-options` (labels:view). Typical values include `ALM-NY`, `DEV-NY`, `EN TRANSITO`, `ALM-RD`, `DEV-RD`, `CONDUCE`, `ENTREGADO`, `SUBASTADO`.

**Default on create:** every newly created barcode / invoice line-item label should start as **`ALM-NY`**. The API should set this when status is omitted (including barcodes created with the invoice). The portal also sends `ALM-NY` when it must gap-fill a missing label so creates are never empty. Later location changes stay manual.

**Barcode statuses** (`/barcode-statuses`) opens from the **Barcode Statuses** header action on both the Barcodes table and Barcode Scanner, subject to the existing labels view permission. It has no separate sidebar entry. Its list, create, update, and delete UI is wired for the forthcoming barcode-status catalog API.

**Barcodes table (Barcode Manager):**

- View: barcode, invoice, description, container, status, route (when assigned)
- Search / filter: invoice, description, container, status, route
- Multi-select bulk: print selected labels, change status, transfer container, assign route
- “Manage invoice items” on selected invoices opens the Barcodes table filtered to those invoices. The separate Label manager workflow is retired.
- Printing uses the existing labels report with selected barcode IDs; selection is scoped to the current page and resets when paging or filtering.
- No direct create / edit / delete — those belong on the invoice

**When editing an invoice (line items + labels):**

| Change | Barcode behavior |
| --- | --- |
| Label count decreases | Prompt the user to pick which barcode(s) to delete; do not delete arbitrarily |
| Description changes (count unchanged) | Update associated barcode descriptions to match the line item |
| Label count increases | Keep existing barcodes; generate only the additional labels needed |
| Label count unchanged | Keep existing barcode associations |
| Line item deleted | Delete all barcodes on that line item |

On invoice-embedded barcodes, **`barcodeId`** is the unique ObjectID used for print selection and matching. Numeric **`id`** is the package sequence only (not unique across invoices). Selected-label printing uses `POST /reports/labels` with `collection=barcodes` and `lookup_field=id`.

TODO (backend): return `invoice` / `description` on `/barcodes` list+search, and allow filtering by `invoice.number`, `description`, `container.name`, `status.name`, and `route.name`. When creating barcodes with the invoice, upsert the same records into the `/barcodes` catalog (or expose a barcode→invoice lookup) so invoices, Barcode Manager, and the scanner stay aligned.

Barcodes can be used to:

- Identify individual items
- Track item location status
- Associate items with invoices
- Track movement through our operations
- Update item status through scanning

### Barcode Scanner

The barcode scanner provides a quick way to scan an item's barcode and update its location status.

Scanned numbers are merchandise labels that originated on an invoice. Resolve by invoice embed first, then catalog. This allows workers to mark where merchandise is without opening the invoice. Status pickers load from the same `status-options` endpoint.

Delivered merchandise labels retain the daily route that delivered them; their route cannot be reassigned or removed. Completed appointments likewise retain the route that completed them. New route assignments must use a daily route dated today or later. Unfinished records may move from an old route to a valid destination or be unassigned. Backend enforcement, the authoritative business timezone, and the barcode route-removal contract remain pending in `docs/backend-api-gaps.md`.

### Inventory

Inventory manages the company's **internal supplies and materials**, separate from customer merchandise. Stock belongs to persistent warehouse, employee, vehicle or route-crew holders. Current wire models are in `api-docs.json`; remaining integration work is in `docs/inventory-workflow.md`.

Stock belongs to a persistent **holder**: a warehouse, employee, vehicle, or route crew (`/inventory/holders`). A daily route is context only, never a stock destination. Quantities are never stored on items; they come from read-only **stock balances** per item, holder and condition (`AVAILABLE` / `QUARANTINED`).

The sub-tables under Inventory use that contract:

- **Stock** (`/inventory/items`): supply catalog (`name`, `sku`, `category`, `unitOfMeasure`, `defaultSellingPriceMinor`, `reorderThreshold`, `isActive`). Available / quarantined quantities are summed from `/inventory/stock`. Items are **deactivated**, not deleted (the API has no DELETE). "Adjust stock" creates and posts an `/inventory/adjustments` document.
- **Receipts**: multi-line purchases from a supplier into a **warehouse** holder (`lines[]` of item, quantity, `unitCostMinor`). Posting increases stock and valuation.
- **Dispatches**: multi-line transfers from a warehouse to an employee, vehicle or crew holder (optional responsible employee and daily-route context). Dispatches record **no revenue**.
- **Suppliers**: `companyName`, `contacts[]` (`{name, phone, email}`), `addresses[]`, `isActive`. Deactivated, not deleted.

Receipts and dispatches are versioned documents: created as **DRAFT**, edited with PATCH + `If-Match`, then **posted** (`If-Match` + `Idempotency-Key`) or **cancelled** (`If-Match`). Posting submits the document as **PENDING_CONFIRMATION**. A receipt adds stock only when the **warehouse** confirms it. A dispatch reserves the source stock and moves it to the holder only when both the **warehouse** and the **custodian** (responsible employee, holder employee, crew member or route supervisor) confirm the handoff. Either party can reject with a reason, which returns the document to DRAFT. Confirmations need `canConfirmInventoryWarehouse` / `canConfirmInventoryCustodian` plus the API's per-user `allowedActions`. The same user cannot confirm both sides. Pending, posted and cancelled documents are read-only. The Stock table also shows **In warehouse** and **Pending** (in custody with employees, vehicles or crews, not reconciled yet). Remaining acceptance: `docs/inventory-workflow.md`; wire models: `api-docs.json`. Money is integer USD cents (`…Minor`); `receivedAt` / `dispatchedAt` / `occurredAt` are UTC instants; `businessDate` is a calendar date. The server-owned `audit` block (`createdAt`, `createdBy`, `updatedAt`, `updatedBy`) is never sent.

**Supply operations** (`/inventory/workflow`, behind `NEXT_PUBLIC_INVENTORY_WORKFLOW_ENABLED=true`) covers the rest of the lifecycle: returns, loss & damage dispositions, physical counts, adjustments, aggregate supply sales, payments and allocations, office cash handovers, collection obligations and settlements, daily closeouts (preview, close, reopen, revisions), holder custody and reassignment, item price history, route crews, daily routes, and the stock-valuation / sales / obligations / discrepancy reports, audit events and journal entries. Closeout requires available and quarantined counts that reconcile with a fresh server preview; financial differences require an explanation. Reopening needs `closeout.reopen` and a reason, and creates a new immutable revision. Retained stock persists overnight with its holder.

Daily Income **Add transaction categories** are Invoices (New invoice, Invoice payment, Discount, Surcharge), Income & expenses (Income, Expense), Inventory (Inventory movement, Inventory payment), Loans (New loan, Loan payment), and Account transfers (Transfer between accounts). The chooser shows a category list beside one category’s action rows on desktop. Small screens and the phone presentation use expandable category sections with one category open at a time. Invoices opens by default; returning from a transaction restores its category. Desktop shows contextual help for the focused or hovered action; small screens keep descriptions beside each action. Choosing an action immediately continues its existing workflow.

**Register new loan / Register loan payment** reuse the dedicated loan creation and employee loan-payment dialogs and existing loan APIs, including the existing payment allocation rules. They do not post a generic `LOAN` journal directly. The chooser reuses its employee/account lookups, and payment loans load only after selecting an employee. Loan actions inherit the Add transaction journal-create and income-statement-view gates; the API remains authoritative for loan permissions.

**Register new invoice** starts an `INITIAL-PAYMENT`; **Register invoice payment** starts a `PAYMENT` for an existing invoice. Both retain Assignment → Invoice details → Payment & references → Review. Their invoice mode is fixed by the chosen category. Existing invoices display sender, receiver, total, discount, paid, and balance read-only above the payment amount. New invoices allow system or custom numbers, optional sender/receiver, and Total/Discount/Paid with the calculated Balance. After saving, the same category remains active and shared employee/daily-route and payment-method selections carry forward.

**Register inventory payment** opens the existing Inventory → Pending Transactions dispatch reconciliation/payment workspace. This card requires inventory dispatch list and reconcile permissions; it does not introduce a journal transaction type or a new endpoint. **Register new inventory** reuses the existing `INVENTORY` journal entry form.

**Register inventory change** still posts a journal with `transactionType: "INVENTORY"` (its own journal contract). Do not record the same supply movement both there and through receipts/dispatches.

### Routes

Routes organize day-to-day appointment stops and delivery stops.

**Route crews** require at least two distinct employees when adding or editing in the portal. The API must enforce the same minimum. For a single employee, assign the `employee` field instead of creating a crew. They are reusable people templates: **status**, **branch**, and **crew members**. They have no `name` (the crew members already identify it), date, vehicle, or driver/supervisor/helper roles. The portal labels a crew by its member names.

**Route crew management** (`/routes`) opens from the **Route Crews** header action on Daily Routes or beside route-crew selectors in the daily-route form and shared crew-assignment dialog, subject to the existing route-view permission. It has no separate sidebar entry. Inventory crew holders use their separate `/route-crews` catalog.

**Today’s Routes** (UI name; `/daily-routes`) sets up each day’s vehicle, crew, roles, and exchange rate. These daily routes are the dated working route for a visit or delivery day: **branch**, **date**, **vehicle**, and **employees with roles** (driver, supervisor, helper(s)). Daily routes do not store a route crew. In the form, employees can be added one by one, or filled in from a route crew as a shortcut (the crew is not saved). The minimum is one employee who is both driver and supervisor; the first hand-picked employee takes any lead role still open. If the branch is RD, the form also includes **container** and **exchange rate**. They have no status/active flag, no `dayOfWeek` (derived from the date), and no legacy `type` (`routeType` is canonical). Daily-route names are generated by the API as `YYYY-MM-DD_Vehicle_Supervisor+Employee+…` from the date, vehicle, supervisor, driver and helpers, are read-only, and are never included as a top-level `name` in Add/Edit requests. Roles are assigned on the daily route, never on the crew template.

A new daily route can start from a previous day’s configuration. Copying to another date is allowed; the API rejects duplicates using the exact employee ID set (independent of order), vehicle, and date.

The same employee can be driver and supervisor, or driver, or supervisor, or helper. A helper holds only the helper role. Every daily route needs at least one supervisor and one driver (they can be the same person); the portal blocks saving without them, and the API must enforce the same.

**Predefined routes** (`/predefined-routes`) are reusable named coverage filters, separate from route crews and daily routes. The list shows ID, name, Cities, and ZIP codes. The form retains one ordered mixed city/ZIP textbox list. Data is persisted through `/v1/predefined-routes` in the tenant `predefined_routes` collection. The appointment Route selector (below advanced filters) sends `predefinedRoute.id`; the API matches the customer sender address city OR ZIP and combines this restriction with existing filters using AND before counting/pagination. Add is available beside the selector; Edit/Delete are only in the catalog. Migration follow-up: `docs/predefined-routes.md`; API shapes: `api-docs.json`.

Route concepts and wire-model boundaries:

**Route crews** (`/v1/routes`): reusable people templates. Persist only **active**, **branch** (`id` + `code` + `name`), and **employees** (`id` + `name`, at least two distinct ids). Do not persist `name`, date, vehicle, trip number, or driver/supervisor/helper roles on the crew. Strip those fields from existing crew records. Reject create/update when another crew in the same company already has the same **branch** and the same **employee id set** (order-independent; compare ids, not names).

**Daily routes** (`/v1/vehicle-routes`): dated working route. Persist **branch**, **date**, **routeType**, **vehicle** (`id` + `name`, optional `branch`), **supervisor**, **driver** (each `id` + `name`; may be the same employee), **helpers** (`id` + `name` list, helper role only), and **employees with roles** (`driver` | `supervisor` | `helper`). The portal sends the canonical `supervisor`, `driver` and `helpers` fields and never sends `name`, `dayOfWeek`, `type` or a `route` crew reference (drop `route` from the model; it is ignored on read). Invoices and Daily Income journals no longer copy a crew from the daily route: invoice `receivedBy`/`route` carry only the daily route `id` + `name`, an invoice update sends `routeCrew: null`, and journal route assignees have no nested crew. The API validates that every assigned employee exists, and generates the `name` and regenerates it whenever the date, vehicle or assigned employees change. RD/DR/DO branches also require **container** and may include **rate**. Daily-route `employees` are chosen freely within the branch (they need not match any crew). `vehicle` is required. Do not use `active` as a user-facing status. Duplicate detection compares the exact **employee ID set + vehicle + date**, independent of employee order; the API enforces company/branch scope. Copying a previous day’s configuration onto a new date is allowed. Backfill legacy daily routes that stored vehicle only on the crew, or that have extra/missing employees vs the linked crew.

Daily routes can be created from the Daily routes workspace, or when assigning appointments or invoice barcodes (choose an existing daily route, or open the add daily route form).

The system allows us to:

- Group appointments and deliveries by route crew
- Assign routes to workers
- Order and sequence appointments
- Order deliveries
- Organize stops efficiently
- Track route activity and performance

This section helps coordinate the day-to-day movement of employees and merchandise.

#### Route Deliveries

**Complete delivery balance gate:** Completion requires an authoritative finite invoice balance of exactly zero and no linked uncleared receipts. Cash receipts apply immediately; bank receipts apply through journal clearance. The wizard rechecks the API balance before completion; it does not subtract pending payments locally or offer an uncleared-payment override. Payments remain independent of delivery cancellation. Payment entry uses the collecting branch's current closeout and its permissions; opening a missing period requires the separate closeout-create grant. USD/DOP display uses the documented route rate. Remaining atomicity, assignment and balance-case acceptance is in `docs/delivery-completion-api-contract.md`.

Portal route: `/deliveries` (**Route Deliveries** in the Routes sidebar). This is the restricted barcode work table: **Deliver** and **Print invoice** are its only record actions. `canViewDelivery` returns all tenant pending pieces; `canViewAssignedDeliveries` returns only the authenticated employee’s assigned delivery work. The same controls apply to both scopes; the API enforces assignment isolation. The API may include pending pieces without a route or numeric delivery for broad-access users. Delivery requires a valid numeric delivery; invoice printing requires only a linked invoice. Columns include barcode, invoice, balance and its DOP equivalent, daily-route rate, merchandise, container, sender/receiver contact details, address and city. Server sorting defaults to city ascending. On phones, records become cards grouped by city when sorting by city. The status is chosen explicitly by the driver. The main **Barcodes** table also exposes permission-gated **Deliver** (pending CONDUCE pieces with invoice and numeric delivery) and **Print invoice**, reusing the same delivery wizard and signature-selection print dialog.

The list comes from `GET /v1/deliveries/assigned-barcodes` and `POST /v1/deliveries/assigned-barcodes/search`; the API owns tenant, pending status, and assigned-only scope and joins invoice parties. The portal does not resolve employee membership client-side. Completion accepts `canUpdateDelivery` or `canUpdateAssignedDeliveries`, alongside the required invoice access. Contract: `docs/delivery-completion-api-contract.md`.

#### Route Appointments

`/route-appointments` reuses the Appointments table with the same search, filters, server pagination, viewing, editing, completion, printing and invoice creation workflows, subject to each action’s permission. Route management, deletion and standalone appointment creation are absent in this workspace, including mobile cards and detail sheets. Its map (`/route-appointments/map`) is for viewing stops and has no assignment, removal or route ordering controls. General Appointments keeps its existing controls. Both list and search use the existing pickups API: `canViewPickup` defaults to all permitted appointments; `canViewAssignedAppointments` is restricted by the API to the signed-in employee’s pickup routes. Updates accept the ordinary or assigned-appointment update grant; assigned-only writes cannot change route assignment. The UI does not filter an already downloaded page to infer assignment.

**Deliver** is an invoice-level logistics operation scoped to the selected
route/delivery and its pending merchandise pieces, including pieces beyond the
visible table page. The API owns group membership and permitted selection.
Operational DR daily-route identity and legacy numeric delivery identity must
not be substituted for each other without the agreed wire contract; remaining
identity/migration work is in `docs/delivery-completion-api-contract.md`.

The wizard reviews balance, selects pieces, optionally uploads photos, captures
the actual receiver and signature, and submits completion. The delivery receiver
may differ from the invoice receiver; signing never changes the customer party.
Signature images are write-only and rendered into PDFs server-side. Read and
completion responses expose metadata, not image bytes.

Completion uses the documented atomic API command with a stable UUID and exact
payload on retry. It associates the selected photos, saves the private receipt
and changes only selected pieces together. Uploaded attachments persist
independently when completion fails or is cancelled. Printing uses metadata-only
signature options and the existing server PDF endpoint. API permissions, versions,
assignment checks and failure behavior remain authoritative.

### Customers

Customers manages our clients and their information.

Customers can be associated with both:

- Appointments
- Invoices

This allows us to maintain a complete history of a customer's interactions, including their appointments, shipments, invoices, and merchandise.

### Vehicles

Vehicles manages the company's fleet.

The system stores and manages information about company vehicles, including their assignments and operational use.

Vehicles can also be associated with employees, routes, and deliveries where applicable.

### Accounting

Accounting lives in the daily sidebar band with Appointments and Invoices (frequent use).

Accounting manages financial activity both inside and outside of the system.

It includes:

- Payments
- Transactions
- Income
- Expenses
- Transaction records
- Historical financial records
- Bank activity
- Accounting classifications

The goal is to maintain a centralized financial history of the company's operations.

### Today's Transactions (Daily Income)

Today's Transactions (`/accounting/daily-income`) records and browses a closeout's
invoice registrations/initial payments, existing-invoice payments, adjustments,
income, expenses, inventory changes and account transfers. Loan creation and
loan payments use their dedicated feature APIs. Historical closeouts remain
available for browsing; financial writes use the server-selected current period.

**Pending Reconciliation** (`/accounting/pending-financial-activity`) verifies
money custody and supporting documents. **Pending Clearance**
(`/accounting/pending-clearance`) records financial settlement. Both span all
closeouts, use independent journal statuses and can contain the same transaction.
Only explicitly authorized actions are available; role names do not grant access.
Reconciliation never applies invoice receipts. Clearance applies deferred bank
receipts once without changing the original ledger date or period.

Queries, advanced filters and pagination run on the server. Matching and selected
Income / Expenses / Net totals use `/journals/summary`, preserve currency groups,
and do not substitute a current-page total for all matching records.

**Register inventory change** records company supplies as received or dispatched.
Received entries select supplier/item/quantity/cost and link an expense journal
to a receipt. Dispatched entries select item/quantity/value and responsible
holders and link a sales journal to a dispatch. The journal and linked document
commit together; stock changes follow the required receipt/handoff confirmations.
A permitted `autoReconcile` command must enforce the corresponding backend rules.
A daily route supplies attribution, not ownership of every crew member's stock.

A financial entry belongs to an employee or a daily vehicle-route with its
responsible supervisor. With neither supplied, the API resolves the creator's
linked employee. Employee entries clear route aliases; route entries preserve
route attribution and the supervisor in `employee`. Inventory entries send
`employee: null` and use `inventoryHolders`. Local assignee discriminators are
not persisted.

The internal `refNumber` is separate from `external_reference_number` and the
paper check number. A duplicate-payment conflict (`DUPLICATE_PAYMENT`, message
`Duplicate payment warning`) requires explicit confirmation before retrying the
same values with `allowDuplicatePayment: true`; other conflicts do not authorize
an override. Never carry that override into another payment.

Financial writes respect current grants, versions and backend `allowedActions`.
Protected corrections use an audited void/reversal/correction or approved change
request, with dedicated invoice, inventory and loan lifecycles preserved. Pending
work is in `docs/financial-controls.md` and `docs/payment-accounts-api-contract.md`.

### Checks

Checks manages invoice payments made by check.

CHECK or CHEQUE invoice payments (`INITIAL-PAYMENT` and `PAYMENT`) create an **outstanding check** and do **not** update the invoice `payment` / `balance`. The invoice payment is applied only when the check is marked **cleared**.

The Checks workspace is a read-only clearing directory. Settlement is performed
through the journal's permitted clearance command in Accounting → Pending
Clearance; it is independent of internal reconciliation. Status and audit data
come from the API and linked journal.

**Check number vs internal reference:** The UI always labels this **Check number**. On the backend that value is `paymentReference` (legacy `checkNumber` still dual-read/written). The portal normalizes it to `checkNumber` for UI/code. Keep it as a **string** so leading zeros are preserved when it carries into generated checks. `refNumber` is the **internal** transaction reference only — never use it as the paper check number.

Each check stores:

- Check number (UI `checkNumber` ← API `paymentReference`)
- Internal reference (`refNumber`)
- Amount
- Date posted
- Linked invoice
- Optional journal
- Status (outstanding or cleared)
- Cleared date
- Historical audit fields

### Zelle, Deposits, and Credit Cards (clearing directories)

These directories show bank-channel invoice receipts and their linked journal
settlement state. Outstanding bank receipts apply to invoice balances only through
the permitted journal-clearance command. The directories are read-only; internal
reconciliation and bank clearance are separate operations.

The API resources are `/v1/zelle-payments`, `/v1/deposits` and
`/v1/credit-card-payments`, with their documented read permissions. Current payloads
and independent journal commands are defined in `api-docs.json`.

**Auto-approve in Daily Income:** `autoClear` is the existing wire flag for
internal auto-reconciliation and requires `canReconcileJournal`. It does not grant
or substitute for bank clearance. The frontend must preserve that distinction
and never infer clearance rights from per-method update permissions.

Each clearable payment stores:

- Payment reference (API `paymentReference`; UI label varies by method)
- Internal reference (`refNumber`)
- Amount
- Date posted
- Linked invoice
- Optional journal
- Status (outstanding or cleared)
- Cleared date
- Historical audit fields

### Chart of Accounts

The Chart of Accounts defines the different financial categories used throughout the accounting system.

This includes:

- Income accounts/groups
- Expense accounts/groups
- Bank accounts
- Other financial account categories

These accounts provide the structure used to classify and organize financial transactions.

**Cash and bank umbrellas:** `CASH ON HAND` is the default cash account; any ASSET account nested under it (via Parent account, any depth) is a user-defined cash account. A general `BANK` system account is the bank umbrella; user-defined bank accounts sit under it, and sub-banks under another bank. Cash income lands in a chosen cash account (default CASH ON HAND); every other method lands in a bank account (the general bank when none are defined). Cash expenses leave a chosen cash account; other expenses leave a chosen bank account. Cash-account selection, Debit card/Wire and non-cash expenses are behind `NEXT_PUBLIC_PAYMENT_ACCOUNTS_ENABLED` until the remaining acceptance work in `docs/payment-accounts-api-contract.md` is resolved.

### Items

Items are predefined merchandise references that can be used when creating invoices.

Items are not required for an invoice. They simply provide a convenient shortcut that allows workers to quickly select commonly used merchandise instead of entering the information manually every time.

### Containers

Containers manages the shipping containers used to transport customer merchandise.

Invoices and their associated merchandise can be organized into containers so the system can track which shipments are being transported together and where they are in the shipping process.

The containers page KPI **Average value per container** is the mean **invoice merchandise total** (not container shipping `cost`) across containers that **departed** in the selected rolling window (`7d`, `30d`, `3m`, `6m`, `1y`). The portal reads `GET /v1/containers/stats/average-value?period=…`.

That aggregation:

1. Takes containers whose `departureDate` is in the rolling window (exclude future scheduled departures).
2. Assigns **non-void** invoices by `invoice.container._id`. Invoice digitize/`createdAt` date is **not** filtered.
3. Sums invoice detail merchandise totals, falling back to invoice `cost` when there are no details.
4. Averages across every departed container in the window. Containers with no invoices count as `$0`.
5. Returns `average`, `previousAverage`, `containerCount`, `totalValue`, plus `period` / `timezone` / window metadata.

### Employees

Employees groups the employee directory and its supporting catalogs in one sidebar section:

- Employees (`/employees`)
- Employee titles (`/employee-titles`): tenant job-title catalog with a name and active status; employees reference the title name. New tenants receive stock seed titles (for example Driver, Dispatcher, Warehouse, Support, Planner, Admin, Manager, Supervisor).
- Employee departments (`/employee-departments`): tenant department catalog with a name and active status; employees reference the department name. New tenants receive stock seed departments (for example Operations, Warehouse, Fleet, Customer Service, Administration, Accounting).

On employee create, `active` is optional in the API payload: omitted defaults to active; explicit `false` stays inactive. The portal form defaults to active and always sends the chosen boolean.

### Users

Users groups portal login accounts and the company-wide audit log in one sidebar section:

- Users (`/users`)
- User Activity (`/user-activities`): audit log of who did what across the system

### Admin

Admin manages the company's system configuration and administrative information.

This includes:

- System settings
- Roles and permissions
- Company configuration
- Invoice policies (text customers review and sign during invoice create)
- Other administrative controls

#### Invoice policies

Portal route: `/invoice-policies` (Admin sidebar). Tenant catalog of policy titles and body text with sort order and active flag.

Active invoice policies are shown during **invoice creation** in the review step. The customer must agree to active policies. “Skip signature” is checked by default; unchecking it requires a signature (mouse or touch), including when there are no active policies. Creation sends `customerSignature: { signerName, data, contentType }` using the sender name, raw base64 PNG data, and `image/png`. The API supplies `signedAt` and `collectedBy`. Edit payloads omit signatures so the API preserves them; invoice JSON responses exclude both signatures. The signature is stored on the invoice instead of uploaded as a policy agreement document.

Report mapping: sender signature → Autorizado por; receiver signature, API signing date, and submitted ID → Recibido por / Fecha / ID. Receiver signatures are collected through the shared delivery wizard opened from **Route Deliveries** or the permission-gated **Deliver** action in Barcodes.

Permissions: `canListInvoicePolicy`, `canViewInvoicePolicy`, `canCreateInvoicePolicy`, `canUpdateInvoicePolicy`, `canDeleteInvoicePolicy` (`resourceType: invoice_policy`).

#### User Activity (Users)

Replaces the legacy screen at `tenares.embarqueros.com` → `#menu/useractivities`.

Portal route: `/user-activities` (Users sidebar). The portal is a **read-only consumer** of activities recorded by the API.

The API exposes normalized user activity rows for the current company tenant through
`GET /v1/user-activities` and advanced search through
`POST /v1/user-activities/search`.

- Activities include timestamp, user, description, origin, entity `id`, quantity, and API-owned severity.
- Portal invoice “activity” timelines are **frontend-synthetic** (built from invoice create/payment/comment data) — not a system-wide audit log.

Do not confuse:

| Concept | Means |
| --- | --- |
| Users → User Activity | Company-wide audit of user actions (`origin` + entity `id`) |
| Invoice view → Activity | Per-invoice synthetic timeline in the portal only |

##### Portal rules (read-only consumer)

- Display `user.name` (and other activity fields) **exactly as returned** by list/search.
- Do **not** resolve, enrich, or “fix” actors by looking up users (or any other resource) client-side when `user.name` is an id, email, or empty.
- Do **not** write user-activity rows from the portal; the API owns the write path for all clients.
- Severity is API-owned: common = default, uncommon = yellow, rare = red — display only.

##### Backend activity contract

1. **Data model** (every activity):
   - `timestamp` — when it occurred
   - `user` — who performed it; required shape:
     ```json
     "user": { "id": "<stable-user-id>", "name": "<canonical display>" }
     ```
     - `id` — always the EMSYS user id (consistent type across writers)
     - `name` — always a human display value (prefer email or full name; **never** put the raw numeric id in `name`)
   - `description` — human-readable action text
   - `origin` — module/entity type (`invoice`, `payment`, `income_statement`, …)
   - `id` — **entity** record id (with `origin`, identifies the referenced record; **not** a separate `invoice` field)
   - `quantity` — optional, only when relevant
   - `severity` — `common` | `uncommon` | `rare` (API-owned; never computed on the frontend)
   - Document primary key: expose as `_id` / `activityId` so it does not collide with entity `id`

2. **Centralized severity mapping** (API decides from action type), e.g.:
   - Common — normal create/update/view-style work
   - Uncommon — posting payments, closing daily incomes
   - Rare — deletes, reopening cuadres, destructive ops

3. **Write path** — record activities in the **API** on relevant mutations so all clients (portal, legacy, scripts) are covered. Frontend must not be the sole writer.

4. **TODO (API): Normalize `user` on every user-activity row**

   **Problem:** The same actor can appear as either a numeric id (`"73"`) or an email (`"elk@elk.com"`) in User Activity, depending on which write path recorded the row (e.g. legacy label/manifest writers vs newer invoice / income-statement / pickup writers). The portal only displays `user.name` and must not resolve this client-side.

   **Work items:**
   1. **Centralize the write helper** — one `RecordUserActivity` (or equivalent) that always builds `UserRef` from the authenticated user (`id` + email/fullName). Ban ad-hoc string/id-only actor writes.
   2. **Audit all activity writers** — especially label/barcode/manifest paths that still store a bare numeric id as the actor label; route them through the helper.
   3. **Legacy / historical backfill** — when mapping old rows, if `user` is only a numeric id, resolve to `{ id, name }` via the users table; if resolution fails, keep `id` and set `name` to a clear fallback (e.g. `User #73`), not the bare id alone when email is known.
   4. **Contract test** — list/search fixtures assert `user.id` and `user.name` are both present and `name` is not a pure numeric string when a user record exists.

   **Out of scope for portal:** frontend stays a read-only consumer; do not “fix” by looking up users client-side.

5. **Legacy alignment** — map historical user-activity rows into the new shape without dropping data:
   - timestamp / user / details → `timestamp` / `user` / `description`
   - legacy invoice (or similar) → `origin` + `id`
   - keep `quantity` when present
   - assign historical `severity` from action/type mapping
   - fallback origin (e.g. `legacy`) when classification is unclear; preserve leftover fields in description or metadata rather than discarding
   - when remapping `user`, follow the `UserRef` shape in item 1 and the TODO in item 4

6. **List API** (portal directory):
   - `GET /v1/user-activities` — paginated list (default sort `timestamp:desc`)
   - `POST /v1/user-activities/search` — Stripe-style search (user, description, origin, entity `id`, severity, date range)
   - Permission: `canViewUserActivity`, granted to `Administrador`
   - OpenAPI/Swagger documents the model and endpoints

### Reports

Reports lives in the operations sidebar band with Barcodes, Inventory, Containers, and Routes.

Reports generates printable PDFs from operational records (pickup manifests, invoices, labels, income statements, journals, loans, and delivery manifests). The Reports workspace is the generate-and-download hub; print actions also live on those source workspaces.

The API only exposes generate endpoints (`POST /reports/{type}`) plus a public download (`GET /public/reports/{token}`). There is no list or CRUD collection of saved reports.

### Insights

Insights provides analytics and business intelligence that can help management improve operations and make better decisions. The Dashboard already surfaces these KPIs, so Analytics is not listed in the sidebar (the `/analytics` route may still exist for deep links).

Dashboard KPI cards and all-time weekday/month charts use `dashboard:view`:

- `GET /v1/insights/kpis?period=7d|30d|3m|6m|1y` — rolling current + previous windows in one aggregation per KPI (`newAppointments`, `newInvoices`, `newCustomers`, `departedContainers`, `averageValuePerContainer`)
- Containers **Average value per container** uses the dedicated `GET /v1/containers/stats/average-value` endpoint instead of the insights field
- `GET /v1/insights/histograms/{appointments|clients|invoices}` — weekday/month histograms in the company/app timezone

Examples include:

- Driver/employee efficiency
- Route efficiency
- Income trends
- Expense trends
- Business trends
- Operational performance
- Shipping volume
- Other key performance indicators

The goal is to turn the operational and financial data collected throughout the system into useful information for decision-making.

### Daily route attribution and accountability

**Daily route = operational attribution and analytics. Supervisor = financial accountability and reconciliation. Inventory holders = one or more employees and/or a vehicle jointly responsible for one inventory assignment.** These stay independent; referencing a daily route never makes every crew member or the vehicle responsible for a record. Contract: `docs/daily-route-accountability.md`.

- **Inventory:** dispatched supplies keep the optional daily route for analytics and require at least one holder (single employee, several employees, a vehicle, or a vehicle with employees). "Use route vehicle and crew" is only a shortcut; users decide who is responsible. All holders share one assignment (20 boxes to a vehicle and two employees is 20 boxes, not 60); reconciliation clears it once for all holders and keeps the route reference.
- **Appointments and invoices** keep their daily-route association for analytics only; an appointment creates no financial accountability unless a payment is recorded.
- **Payments, income and expenses** attributed to a daily route are registered under the route's **responsible supervisor** (pre-selected when the route has exactly one; chosen explicitly when it has several), never the whole crew. The recorded supervisor survives later route edits.
- **Accounting → Pending Transactions** reconciles per supervisor (`employee`), payment method and collection date, and shows the original daily route.

The inventory ledger dispatch documents (`/inventory` workflow) still use a single destination holder; joint holders there await a backend ledger design.

### Daily-route supervisor terminology

Supervisor is the canonical crew role (`supervisor`) in API payloads, filters,
forms, tables and details. Daily routes expose `supervisor` alongside `driver`.
Driver/supervisor combined assignments and singleton lead-role behavior remain
supported. Deploy with the API supervisor contract change; legacy role data must
be migrated before switching clients.

### Closeouts and pending financial activity

Closeouts are opened explicitly using the server date and branch timezone.
RD/DR/DO branches supply currency/rate; other branches use USD/rate 1. Journals
use the current authorized location period, never a viewed historical date or
caller-selected old period. Closed periods remain read-only for membership;
later reconciliation and settlement do not reopen them.

Missing-period recovery follows `CLOSEOUT_REQUIRED`. Pending transaction inputs
must survive setup failure/cancellation and must not be reposted if already
committed. See `docs/transaction-triggered-closeouts.md` for remaining acceptance.

Accounting's two pending queues use server search, sorting, totals and scoped
permissions. Reconciliation checks internal custody; clearance settles bank
receipts. Backend versions and `allowedActions` govern edits and audited
corrections. Current unresolved work is in `docs/financial-controls.md`.

**Inventory → Pending Transactions** (`/inventory/pending-transactions`) tracks
posted supplies until every unit is accounted for. Reconciliations cover sold,
returned, damaged, lost, missing and stolen quantities; unaccounted stock stays
with its holder. Sold supplies can include payments and an unpaid collection
obligation. Notes explain losses and credit. Warehouse and responsible custodian
confirm before effects apply. Entries whose sales were recorded at dispatch
cannot record that revenue twice. This workspace has its own dispatch-list and
reconciliation permissions, independently of accounting access. Remaining cases
and contract decisions are in `docs/inventory-workflow.md`.

Journal summaries preserve currencies and exclude non-income/expense transfers,
discounts, surcharges and loans according to the shared classification helper.
Current contracts are published in `api-docs.json`; pending implementation and
migration work is indexed in `docs/backend-api-gaps.md`.

### Add transaction starts the current closeout

Daily Income's Add transaction action is available with a selected branch and
journal-create/closeout-view permissions even when no closeout is open. The action
refreshes the server-selected current closeout. If missing (null or HTTP 404) or
closed, it requires `canCreateIncomeStatement` and posts to the documented
`POST /income-statements` endpoint with branch, currency, and rate only. No browser
or historical date is sent. RD/DR/DO branches show currency/rate setup; others use
USD at 1. Successful creation continues into transaction entry on desktop or
mobile using the returned closeout. Setup failures preserve the currency/rate
inputs and allow retry. Other lookup errors never trigger creation. Rapid clicks
are serialized, and changed company/user/branch context prevents continuation.

This implements setup **before transaction entry**. A draft rejected at submission
time with `CLOSEOUT_REQUIRED` (for example after midnight) is handled separately by
the closeout rollover dialog; this action does not automatically retry a journal
mutation or reopen a closed period. Backend creation must enforce the
reported server-date/timezone, stale-period closure, and concurrency invariants.

### Financial controls

Reconciliation records internal verification; bank
clearance records settlement and applies deferred invoice receipts. Backend
`allowedActions` and version checks govern direct edits, voids, notes and
reversals. Daily-route operators request protected changes through
`/change-requests`; authorized reviewers may approve their own requests. Explicit
closeout opening remains in place, and neither later verification nor settlement
reopens a historical period.

### Protected daily-route records

“Street Team” refers to employees assigned to a dated daily route. Request actions
must be authorized by the API for that record; frontend role names and route
filters do not enforce ownership. The portal's prepared shared workflow now has
entry points from the five resource detail views, validated target/version/action
checks, stable retries, and no journal hard-delete client. Its editor currently
covers limited fields and inventory dispatches only.

Approval, assignment isolation, atomic corrections and audit invariants require
server enforcement. Their remaining acceptance cases are in
`docs/financial-controls.md`.
