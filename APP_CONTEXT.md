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
- Daily routes live at `/daily-routes` (pickup-delivery-routes components; `/appointment-routes` and `/delivery-routes` redirect here)

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

**Barcode statuses** (`/barcode-statuses`) belongs under the Barcodes sidebar group. Its list, create, update, and delete UI is wired for the forthcoming barcode-status catalog API.

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

### Inventory

Inventory manages the company's **internal supplies and materials**, separate from customer merchandise. It follows the ledger model in `inventory.md`, which the live Swagger now publishes under `/v1/inventory/...` (see `docs/inventory-swagger-verification.md`).

Stock belongs to a persistent **holder**: a warehouse, employee, vehicle, or route crew (`/inventory/holders`). A daily route is context only, never a stock destination. Quantities are never stored on items; they come from read-only **stock balances** per item, holder and condition (`AVAILABLE` / `QUARANTINED`).

The sub-tables under Inventory use that contract:

- **Stock** (`/inventory/items`): supply catalog (`name`, `sku`, `category`, `unitOfMeasure`, `defaultSellingPriceMinor`, `reorderThreshold`, `isActive`). Available / quarantined quantities are summed from `/inventory/stock`. Items are **deactivated**, not deleted (the API has no DELETE). "Adjust stock" creates and posts an `/inventory/adjustments` document.
- **Receipts**: multi-line purchases from a supplier into a **warehouse** holder (`lines[]` of item, quantity, `unitCostMinor`). Posting increases stock and valuation.
- **Dispatches**: multi-line transfers from a warehouse to an employee, vehicle or crew holder (optional responsible employee and daily-route context). Dispatches record **no revenue**.
- **Suppliers**: `companyName`, `contacts[]` (`{name, phone, email}`), `addresses[]`, `isActive`. Deactivated, not deleted.

Receipts and dispatches are versioned documents: created as **DRAFT**, edited with PATCH + `If-Match`, then **posted** (`If-Match` + `Idempotency-Key`) or **cancelled** (`If-Match`). Posting submits the document as **PENDING_CONFIRMATION**. A receipt adds stock only when the **warehouse** confirms it. A dispatch reserves the source stock and moves it to the holder only when both the **warehouse** and the **custodian** (responsible employee, holder employee, crew member or route supervisor) confirm the handoff. Either party can reject with a reason, which returns the document to DRAFT. Confirmations need `canConfirmInventoryWarehouse` / `canConfirmInventoryCustodian` plus the API's per-user `allowedActions`. The same user cannot confirm both sides. Pending, posted and cancelled documents are read-only. The Stock table also shows **In warehouse** and **Pending** (in custody with employees, vehicles or crews, not reconciled yet). Contract: `docs/inventory-dispatch-workflows.md`. Money is integer USD cents (`…Minor`); `receivedAt` / `dispatchedAt` / `occurredAt` are UTC instants; `businessDate` is a calendar date. The server-owned `audit` block (`createdAt`, `createdBy`, `updatedAt`, `updatedBy`) is never sent.

**Supply operations** (`/inventory/workflow`, behind `NEXT_PUBLIC_INVENTORY_WORKFLOW_ENABLED=true`) covers the rest of the lifecycle: returns, loss & damage dispositions, physical counts, adjustments, aggregate supply sales, payments and allocations, office cash handovers, collection obligations and settlements, daily closeouts (preview, close, reopen, revisions), holder custody and reassignment, item price history, route crews, daily routes, and the stock-valuation / sales / obligations / discrepancy reports, audit events and journal entries. Closeout requires available and quarantined counts that reconcile with a fresh server preview; financial differences require an explanation. Reopening needs `closeout.reopen` and a reason, and creates a new immutable revision. Retained stock persists overnight with its holder.

Daily Income **Register payment (existing or new invoice):** Add transaction no longer offers a separate Register invoice card. Register payment follows Assignment → Invoice details → Payment & references → Review, and Invoice details starts with **Payment for: Existing invoice / New invoice**. *Existing invoice* posts a `PAYMENT`: pick the invoice, and its sender, receiver, total, discount, paid, and balance display read-only above the payment amount. *New invoice* posts an `INITIAL-PAYMENT`: invoice number (system generated or entered), optional sender/receiver (skipped by default), and an **Invoice amount** section where Total, Discount, and Paid are entered and Balance = Total − Discount − Paid. Switching modes clears invoice-specific fields. After saving, entry returns to Invoice details in the same mode; employee/daily-route and payment-method selections carry forward. Editing keeps the journal's original type (the choice is shown locked).

**Register inventory change** still posts a journal with `transactionType: "INVENTORY"` (its own journal contract). Do not record the same supply movement both there and through receipts/dispatches.

### Routes

Routes organize day-to-day appointment stops and delivery stops.

**Route crews** require at least two distinct employees when adding or editing in the portal. The API must enforce the same minimum. For a single employee, assign the `employee` field instead of creating a crew. They are reusable people templates: **status**, **branch**, and **crew members**. They have no `name` (the crew members already identify it), date, vehicle, or driver/supervisor/helper roles. The portal labels a crew by its member names.

**Daily routes** are the dated working route for a visit or delivery day: **branch**, **date**, **vehicle**, and **employees with roles** (driver, supervisor, helper(s)). Daily routes do not store a route crew. In the form, employees can be added one by one, or filled in from a route crew as a shortcut (the crew is not saved). The minimum is one employee who is both driver and supervisor; the first hand-picked employee takes any lead role still open. If the branch is RD, the form also includes **container** and **exchange rate**. They have no status/active flag, no `dayOfWeek` (derived from the date), and no legacy `type` (`routeType` is canonical). Daily-route names are generated by the API as `YYYY-MM-DD_Vehicle_Supervisor+Employee+…` from the date, vehicle, supervisor, driver and helpers, are read-only, and are never included as a top-level `name` in Add/Edit requests. Roles are assigned on the daily route, never on the crew template.

A new daily route can start from a previous day’s configuration. Copying to another date is allowed; the API rejects duplicates using the exact employee ID set (independent of order), vehicle, and date.

The same employee can be driver and supervisor, or driver, or supervisor, or helper. A helper holds only the helper role. Every daily route needs at least one supervisor and one driver (they can be the same person); the portal blocks saving without them, and the API must enforce the same.

**Predefined routes** (`/predefined-routes`) are reusable named coverage filters, separate from route crews and daily routes. The list shows ID, name, Cities, and ZIP codes. The form retains one ordered mixed city/ZIP textbox list. Data is persisted through `/v1/predefined-routes` in the tenant `predefined_routes` collection. The appointment Route selector (below advanced filters) sends `predefinedRoute.id`; the API matches the customer sender address city OR ZIP and combines this restriction with existing filters using AND before counting/pagination. Add is available beside the selector; Edit/Delete are only in the catalog. Contract: `docs/predefined-routes.md`.

Route modeling (backend changes reported; verify against the next OpenAPI export):

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

#### Deliveries

**Complete delivery balance gate:** The current completion wizard starts with Review balance, then items, photos, signature, and finish. The balance is shown in USD and in DOP at the barcode's daily route `rate`. The API invoice balance must be exactly zero before proceeding and is rechecked before completion. Cash payments apply immediately; check, Zelle, deposit and card payments count only once **cleared**. Users with delivery view (`canViewDelivery`), Cuadre create (`canCreateIncomeStatement`) and journal create (`canCreateJournal`) may post a PAYMENT on today's open Cuadre for their branch (opening today's Cuadre at the route rate when none exists), or refresh after another user settles the invoice. When outstanding non-cash payments for the invoice cover the balance, the same users may **override** the clearance requirement after accepting that they are liable for the payment if it does not clear; the override is rechecked before completion. Payments persist independently of delivery. Atomic backend enforcement is a required follow-up; see the zero-balance section of `docs/delivery-completion-api-contract.md`.

Portal route: `/deliveries` (Routes sidebar, `canViewDelivery`). The driver's work list: barcodes on DR daily routes whose crew includes the signed-in user's employee (`employee.user.id`), excluding barcodes already delivered. Columns: barcode, invoice, invoice balance (open balance of the barcode's invoice, from the list row's `invoice.balance`; blank when the API omits it; with its DOP equivalent at the row's daily route `rate`), name (merchandise), container, status, sender name and sender phones (from the list row's `sender`; blank when the API omits it), receiver name, address + apartment, city (receiver address `city`), receiver phones, and **Deliver**. Default server sort is city ascending; the sort selector offers ascending or descending order by city, barcode, invoice, invoice balance, item name, container, sender name, or receiver name. The status is always chosen by the driver; there is no preselected default. On phones the table becomes cards grouped under city headings when sorting by city, with tap-to-call phone buttons and a full-width Deliver button. This keeps Barcodes strictly for barcode management — Barcodes has no Deliver or signing actions.

The list comes from `GET /v1/deliveries/assigned-barcodes` and `POST /v1/deliveries/assigned-barcodes/search`; the API owns the "assigned to me" and "pending" scoping and joins the invoice receiver. The portal never resolves the current employee or filters assignment client-side. Contract: `docs/delivery-completion-api-contract.md`.

**Deliver** covers every barcode on the clicked invoice assigned to the clicked daily route, across all line items and including rows outside the current page (resolved from the invoice detail; never by line item, package sequence, visible selection, or invoice alone).

**The DR daily route is the delivery.** Its `/vehicle-routes` id both selects the group and addresses the delivery endpoint. The legacy `/deliveries` records (numeric id, `trip-container` name, own employee list) are not linked to daily routes, and new barcode route assignments leave `barcode.delivery` empty, so the portal does not use `delivery.id`. The form contains, in order:

1. **New status** — picked from the tenant barcode status catalog and applied to the group's barcodes that are not already at that status, via the invoice-embedded barcode update.
2. **Delivery documents** — invoice-document uploads (with separate mobile photo and video capture) named `delivery_N` with their original extension, one invoice-wide sequence across file types. Each batch reads all document metadata pages (including original names retained after a rename) and starts above the highest number. Writes are sequential; failed and unattempted files stay queued, completed files are not resent, and completion waits for queued files to be uploaded or removed. Same-origin tabs are serialized with Web Locks. Uploads persist independently of completion.
3. **Terms and conditions** — the active invoice policies with one agreement checkbox; when any exist the receiver must tick it. Completion is blocked while they load or if they fail to load. The agreement itself is not saved separately.
4. **Delivery receiver signature** — the **delivery receiver** (whoever physically receives the merchandise) can differ from the **invoice receiver**. The driver enters the delivery receiver's name, ID number (cédula), and signature; all three are required and start empty. When the invoice receiver is on file, a "Same as invoice receiver" shortcut fills name and ID (still editable). One signature covers both the delivery and the terms agreement. The portal sends it to the invoice receiver-signature endpoint: `PUT /v1/deliveries/{dailyRouteId}/invoices/{invoiceId}/receiver/signature` with `{ receiverSignature: { signerName, idNumber, contentType: "image/png", data } }` (raw base64). In that one request the API **always** saves a `delivery_signature` invoice document (signature PNG plus delivery receiver name, ID, signing time, collecting user, daily route), and **also** stores it as the invoice receiver signature when that field is empty (the first one is never overwritten). The invoice receiver party (`receiver.name` / `IDNumber`) is never changed by a delivery. The portal cannot see signatures on invoice responses and does not make these decisions.

On submit the portal reloads the invoice and rejects a changed group, saves the signature, then writes the status. If the status write fails, Retry skips the already-saved signature. Deliver requires `canUpdateDelivery` (`delivery`), `canViewInvoice`, and `canUpdateInvoice` (`invoice`); the API remains authoritative for driver/route authorization.

**API follow-ups:** the assigned-barcodes endpoint; accept the daily route id (24-character ObjectID) in the receiver-signature path instead of the numeric delivery id; atomic per-invoice `delivery_N` sequence allocation with a durable high-water mark; publishing the receiver-signature endpoint in Swagger.

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

### Daily Income

Closeouts use the server clock and configured location timezone. Transactions
require the latest closeout to be open and dated today; 409 CLOSEOUT_REQUIRED
reasons are NONE_EXISTS, STALE_OPEN_CLOSEOUT, and LATEST_CLOSED. The transaction
attempt never closes rows. Only RD prompts for currency/rate; other branches
use USD/rate 1. POST income-statements with only those two fields. The server owns location/date, preserves today's
existing open row, atomically closes all other open location rows, and returns
or creates today's row. Manual close/reopen/edit/delete and automatic cron
rollover are retired. Calendar navigation uses the context endpoint's server
date/timezone and current/previous metadata. Treat businessDate as a date label.
Draft transaction values survive the recovery dialog, and successful entries
are attributed to the closeout ID actually returned by the server.

When a financial transaction omits both assignee families, the API defaults to
the creator's linked employee, if present. An explicit employee/daily route is
preserved. Inventory dispatch continues to require an explicit stock recipient.

Daily Income is used to manage and record the company's daily incoming transactions.

**Advanced filters and selected totals:** the transactions table has advanced filters for invoice #, date / date range, user, account, cost, payment, balance, amount, employee, transaction type, payment method, check number, external reference number, income statement and internal reference number (`DAILY_INCOME_TABLE_FILTER_FIELDS`). Until the journal search allowlist is confirmed they run in the browser over the closeout rows already loaded (up to 500 per closeout), combining rows left to right like the API filter builder. Selecting rows shows **Income / Expenses / Net income** for the selection, per currency, classified like the Daily Income summary. Accounting → Pending Transactions, a separate page aggregating not-yet-cleared transactions from all closeouts, will reuse these filters, multi-select and totals (`docs/pending-transactions-update.md`). The mobile list does not offer filters or selection yet.

It provides a way to record and track income received each day and maintain a historical record of daily revenue.

**Register inventory change** (after Register income) records company supplies on the closeout: **received** (choose a supplier) or **dispatched** (an optional daily route for reporting plus one or more **responsible holders**: a vehicle, employees, or both; see Daily route attribution and accountability). Users pick an inventory item, quantity, and either unit price or total (the other amount updates automatically). Supplier, employee, and daily route can be created from the dropdown the same way sender/receiver can on invoices and appointments. The journal is posted as `transactionType: "INVENTORY"` with `inventoryDirection`. Received creates a receipt and posts an expense; dispatched creates a dispatch and posts sales. Journal and stock movement happen in one API transaction. When creating a dispatched change, users with `canReconcileInventoryDispatch` can turn on **Auto-reconcile (mark as sold)**, the inventory counterpart of auto-clear. It sends `autoReconcile: true`, and the API completes the handoff and reconciles the full quantity as sold in the same transaction, so the dispatch never shows in Pending Transactions. Do not persist portal-only `assigneeSource`.

A journal is posted under an **employee** `{ id, name }`, or attributed to a **daily vehicle-route** `{ id, name }` (same shape as invoice `receivedBy`) together with the route's **responsible supervisor** in `employee`. The portal picker uses a local `assigneeSource` (`employee` | `route`) so the form can choose which of those to save; do **not** persist that discriminator.

API assignee rules (`POST` / `PUT` `/v1/journals`):

- If neither assignee is provided, default to the creator’s linked employee on the server. Portal validation permits an empty assignee and explains this default.
- Employee journals keep `employee` and clear `vehicleRoute` / `route` / `employeeGroup`.
- Route journals keep `vehicleRoute`, `route`, and compatibility `employeeGroup` **and** `employee` = the responsible daily-route supervisor (required by the portal; the API must validate it is a supervisor on that route).
- Inventory journals send `employee: null`; dispatched inventory carries `inventoryHolders` instead.
- Discriminate route ids by shape: 24-char Mongo ObjectID → daily route.
- Responses and searchable fields include the route assignee fields and a read-only `dailyRoute` snapshot.

**Payment references and duplicate confirmation:** Daily Income transaction forms keep the internal `refNumber` separate from the optional payment reference (`external_reference_number`). The API returns HTTP 409 with `message: "Duplicate payment warning"` for a possible duplicate. The portal offers an explicit confirmation and resubmits the same values with `allowDuplicatePayment: true` only after confirmation. Other conflicts remain normal errors. The override is not a form default and never carries into another payment. Transaction details display the saved payment reference and `duplicatePaymentOverride` audit flag.

### Checks

Checks manages invoice payments made by check.

CHECK or CHEQUE invoice payments (`INITIAL-PAYMENT` and `PAYMENT`) create an **outstanding check** and do **not** update the invoice `payment` / `balance`. The invoice payment is applied only when the check is marked **cleared**.

The Checks workspace is view-only aside from that status change. Staff can search and open a check, and can mark **outstanding** checks as **cleared**. They cannot add checks or delete them from this directory, and a cleared check cannot be moved back to outstanding here. Outstanding status is shown in red and cleared status in green. Checks is not listed in the sidebar. Payments are approved (cleared) by an admin in **Accounting → Pending Transactions**, whose sidebar entry shows the combined count of outstanding checks, Zelle, deposit, and credit card payments (target: all outstanding transactions; see `docs/pending-transactions-update.md`). **Target:** clearing moves entirely to the journal's `reconciliationStatus`, and this directory becomes view-only (no **Mark cleared**).

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

These Accounting directories mirror Checks for invoice payments made by Zelle, bank deposit, or credit card: outstanding payments do not change the invoice balance until marked **cleared**. Each method retains its own directory with search, view, and multi-select **Mark cleared**. Admins approve (reconcile) payments in **Accounting → Pending Transactions**; that view does not link to the directories. **Target:** clearing becomes only the journal's `reconciliationStatus`, OK'd by an admin in Pending Transactions. These directories and Checks then become view-only (no **Mark cleared**), with status taken from the linked journal (`docs/pending-transactions-update.md`).

**API:** `/v1/zelle-payments`, `/v1/deposits`, `/v1/credit-card-payments` — same outstanding/cleared lifecycle and endpoints as `/v1/checks` (list, search, detail, create, update/clear, delete). Each method has its own role permissions (list, view, create, update, delete) on resources `zelle_payment`, `deposit`, and `credit_card_payment`; they are independent of check grants.

**Auto-approve in Daily Income:** When adding an invoice payment (`INITIAL-PAYMENT` or `PAYMENT`) by check, Zelle, deposit, or credit card with an amount above zero, the payment step shows an **Auto-approve (mark as cleared)** switch. It is off by default and only appears when the user has that method's update permission (the same grant as **Mark cleared**). When on, the journal create request sends `autoClear: true` so the API creates the record already cleared and applies it to the invoice balance. It is not offered when editing a transaction, in quick entry, or in the invoice wizard's payment step. Auto-approve is the admin's way to skip **Pending Transactions**: without it, the journal waits there as Outstanding until an admin reconciles it. Admin-only auto-approve for every transaction type and payment method is a backend TODO in `docs/pending-transactions-update.md`.

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

Report mapping: sender signature → Autorizado por; receiver signature, API signing date, and submitted ID → Recibido por / Fecha / ID. Receiver signatures are collected from the **Deliveries** workspace (see Routes → Deliveries), not from Barcodes.

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

### Transaction-triggered closeouts and pending financial activity

Scheduled midnight closeouts are retired. The portal no longer exposes automation settings or requests the automation endpoint; closeouts are created explicitly with the server date and branch timezone, either when Add transaction finds no open current closeout or during Daily Income recovery (`CLOSEOUT_REQUIRED`). Only RD (codes RD/DR/DO) asks for currency and exchange rate; other branches use USD/rate 1. See `docs/transaction-triggered-closeouts.md`. Removing portal settings does not disable an already deployed API cron job.

New journals send an optional branch, never a historical closeout ID or the currently viewed old date. The backend assigns the current accounting period from recording time. Historical closeouts remain viewable but cannot reopen or accept new membership. Posted transactions cannot be edited/deleted; use an auditable reversing adjustment. Active/Inactive are the user-facing closeout states, with legacy OPEN/CLOSED normalized for compatibility.

**Accounting → Pending Transactions** (`/accounting/pending-financial-activity`) is a **separate page** that aggregates every **Outstanding** transaction from **all closeouts**. *Outstanding* means **not yet cleared/reconciled by an admin** — not an unpaid invoice balance. Once reconciled, a transaction leaves Pending Transactions and remains in its closeout in Daily Income. The page has the **same table functionality as Daily Income**: columns, advanced filters, multi-select and selected Income / Expenses / Net income. Reconciliation is just a field on the journal (transaction). **Only admins reconcile** — the admin's OK that the money was received or the expense is approved. Admins can skip this step by turning on **Auto-approve (mark as cleared)** when adding the transaction in Daily Income; anything created without it (or by a non-admin) arrives Outstanding and waits here. Admins filter however they want (payment method, user, employee, dates, …), select rows of one payment method, check the selected totals, and reconcile them together. Reconciling never changes the transaction's date, closeout, amount, employee or daily route. **Reconciled is final:** a reconciled transaction cannot be reversed and never returns to Outstanding. Generic reversals (Outstanding transactions only) additionally require journal-create permission; invoice payments are applied/reversed transactionally.

*Current implementation (until the backend contract ships):* the page still lists `POST /v1/financial-activity/search` rows (unresolved only) with branch, employee, method, date, minimum and age filters. Check/Zelle/deposit/card payments are cleared with each method's own update grant, one row at a time; the target is a single admin OK for every method (`docs/pending-transactions-update.md`).

**TODO (backend/API and portal):** every TODO for the Daily Income and Pending Transactions tables lives in `docs/pending-transactions-update.md`.

**Inventory → Pending Transactions** (`/inventory/pending-transactions`) is a separate workspace that lists posted inventory ledger dispatches whose supplies are not fully accounted for yet, oldest first, filtered by holder, dispatch date and age. **Reconcile** records, per dispatched item, how many units were sold (with actual revenue), returned to the source warehouse, damaged (quarantined or written off), lost, missing or stolen; the remaining quantity stays in the holder's custody. Sales carry payment lines per method (cash; check with bank account and check number; Zelle, deposit or card with bank account and optional reference) that cannot exceed the revenue; any unpaid remainder is a credit sale that becomes a collection obligation for the income recipient (route supervisor or responsible employee). A description is required for losses and for credit. A submitted reconciliation is **pending confirmation**: its quantities show as awaiting confirmation, and stock, dispositions, the sale and income journals apply only when both the warehouse and the custodian confirm. Either side can reject it with a reason. Dispatches whose sales Daily Income already recorded collect no revenue or payments. One submission is one idempotent command, and the dispatch leaves the list when every item is confirmed as accounted for. Viewing needs dispatch list/view permissions; reconciling needs the dedicated `canReconcileInventoryDispatch`, which legacy inventory view grants do not imply. The API contract is proposed in `docs/inventory-dispatch-workflows.md` and must ship with the backend. Its sidebar entry and page require inventory dispatch list permission, independently of accounting access.

**Income / Expenses / Net income totals** classify journals exactly like the Daily Income summary (`src/lib/accounting/daily-income/journal-classification.ts`): income = Payment, Initial payment, Sales, inventory dispatched; expenses = expense account lines, otherwise Expense and inventory received; discounts, surcharges, transfers and loans are excluded; per currency, never converted. Totals across every matching row (all pages) and cross-page selections come from `POST /v1/journals/summary` once it ships — do not substitute current-page totals or download the full directory.

Currency and exchange-rate inputs for daily closeout creation appear only for branch code RD. Other branches use USD/rate 1 without asking the user; this also applies to rollover recovery and invoice registration. RD exchange rate remains editable for either USD or DOP.

Invoice and delivery flows query the server-selected current closeout. Missing periods use explicit server-dated creation with RD-only settings; manual closing/reopening remains unavailable. Generic reversing adjustments do not replace invoice-lifecycle, inventory or loan corrections and require `canCreateFinancialAdjustment` in addition to existing journal/reconciliation grants. Occurrence dates do not determine period membership.

The supplied `api-docs.json` snapshot lacks the transaction-triggered rollover, current-period, financial-activity and reversal endpoint schemas. Regenerate those endpoint definitions from the backend export before claiming full OpenAPI parity; do not restore the retired automation contract.


### Portal alignment status (2026-10-26)

The closeout workspace defaults to the server-selected current closeout and offers a
Current shortcut alongside historical date navigation. Open status is checked
against that current record, without browser-clock period expiration. Current mode
uses the existing current query; a history query only runs for a selected date.
Customer edit conflicts already use the duplicate-customer error presentation;
route and invoice uniqueness remain server-enforced, with mutation failures shown
without clearing the form.

Backend changes reported in this update replace the older proposed rollover
semantics: explicit creation of today's closeout closes older open periods, using
the server date and branch timezone. Scheduled/manual closing and reopening are
retired. Only RD prompts for currency/rate; other branches use USD at 1. The local
OpenAPI export still lacks the recovery error and creation response; do not infer
new wire fields or retry a possibly successful transaction.


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
