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

**Received by** (`receivedBy`) is who took in the merchandise. It replaces legacy `employee` (`core.User`). The value is either the selected **daily route** or a **single employee**. **Received via** (route / warehouse / office) is portal-only so the form can pick which of those to save; do not persist it.

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
    → Label manager: status, container, print, route
    → Barcode Scanner: scan number → update status / container / route
    → Barcodes table: browse / filter / bulk status·container·route
```

**Surfaces (same labels, different jobs):**

| Surface | Role |
| --- | --- |
| **Label manager** | Invoice-scoped: retrieve / manage labels for selected invoice line items |
| **Barcode Scanner** | Operations: find a label by printed number and update location fields |
| **Barcodes table** | Browse / filter / bulk status·container·route (no standalone create/delete) |

Lookups and updates should prefer **invoice-embedded** barcodes when the number lives on an invoice. The `/barcodes` catalog may mirror or denormalize the same labels for directory search and reports; keep both stores in sync when the portal updates status, container, or route.

Barcode **status** is a manual location flag in the logistics process (where the piece is now), not an automatic workflow stage. Workers assign it via the scanner, label staging, or barcode forms. Status options come from the tenant `barcode_statuses` collection via `GET /v1/barcodes/status-options` (labels:view). Typical values include `ALM-NY`, `DEV-NY`, `EN TRANSITO`, `ALM-RD`, `DEV-RD`, `CONDUCE`, `ENTREGADO`, `SUBASTADO`.

**Default on create:** every newly created barcode / invoice line-item label should start as **`ALM-NY`**. The API should set this when status is omitted (including barcodes created with the invoice). The portal also sends `ALM-NY` when it must gap-fill a missing label so creates are never empty. Later location changes stay manual.

**Barcodes table (Barcode Manager):**

- View: barcode, invoice, description, container, status, route (when assigned)
- Search / filter: invoice, description, container, status, route
- Multi-select bulk: change status, transfer container, assign route
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

TODO (backend): return `invoice` / `description` on `/barcodes` list+search, and allow filtering by `invoice.number`, `description`, `container.name`, `status.name`, and `route.name`. When creating barcodes with the invoice, upsert the same records into the `/barcodes` catalog (or expose a barcode→invoice lookup) so Label manager, Barcode Manager, and the scanner stay aligned.

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

Inventory manages the company's internal supplies and materials.

It is separate from customer merchandise and is used to:

- Track stock items (item, quantity left, reorder threshold)
- Maintain suppliers (company name, contacts, addresses, phones, emails)
- Record receipts (item, quantity received, average cost, supplier, date)
- Record dispatches (item, quantity dispatched, income gained, dispatched to employee or daily route, date)
- Derive on-hand stock and average cost from those movements

Every inventory record stores **createdAt / createdBy / updatedAt / updatedBy**. `createdAt` / `updatedAt` are datetimes. Receipt `receivedAt` and dispatch `dispatchedAt` are **dates only**. `createdBy` and `updatedBy` are user refs `{ id, name }`.

Company-scoped inventory API (`/v1/inventory/...`): items, stock (read-only), receipts, dispatches, and suppliers. Catalog stores only `item` and `reorderThreshold`; `quantity` and `averageCost` are read-only from stock. Stock is receipts minus dispatches, with weighted average cost from receipts. Dispatch is rejected when quantity exceeds available stock. Item delete is rejected if referenced by receipts or dispatches. Supplier delete is rejected if referenced by receipts.

**Dispatched to** (`dispatchedTo`) is who received the supplies: a **daily vehicle-route** `{ id, name, route?: { id, name } }` **or** a **single employee** `{ id, name }` (same shape as invoice `receivedBy`). The portal picker uses a local `assigneeSource` (`employee` | `route`); do **not** persist that discriminator. Discriminate by shape: numeric employee `id` vs Mongo daily-route `id` / nested crew `route`.

### Routes

Routes organize day-to-day appointment stops and delivery stops.

**Route crews** are reusable people templates: **status**, **branch**, and **crew members**. They have no date, vehicle, or driver/appraiser/helper roles.

**Daily routes** are the dated working route for a visit or delivery day: **branch**, **date**, **vehicle**, **route crew**, and **crew roles** for each employee on that crew (driver, appraiser, helper(s)). If the branch is RD, the form also includes **container** and **exchange rate**. They have no status/active flag. Daily-route employees come from the selected route crew; roles are assigned on the daily route, not on the crew template.

A new daily route can start from a previous day’s configuration. Copying to another date is allowed; the same route crew cannot be used twice on the same date at the same branch.

The same employee can be driver and appraiser, or driver, or appraiser, or helper.

TODO (backend) — route modeling (portal now follows this; align API + legacy data):

**Route crews** (`/v1/routes`): reusable people templates. Persist only **active**, **branch** (`id` + `code` + `name`), and **employees** (`id` + `name`). Do not persist date, vehicle, trip number, or driver/appraiser/helper roles on the crew. Strip those fields from existing crew records. Reject create/update when another crew in the same company already has the same **branch** and the same **employee id set** (order-independent; compare ids, not names).

**Daily routes** (`/v1/vehicle-routes`): dated working route. Persist **branch**, **date**, **vehicle** (`id` + `name`, optional `branch`), **route** (crew ref `id` + `name`), and **employees with roles** (`driver` | `appraiser` | `helper`; one person may be both driver and appraiser). RD/DR/DO branches also require **container** and may include **rate**. Daily-route `employees` must be the selected crew’s members (no extras). `vehicle` is required. Do not use `active` as a user-facing status. Reject a second daily route for the same **date + branch + route crew**. Multiple daily routes on the same date and branch are allowed when the route crews differ. Copying a previous day’s configuration onto a new date is allowed. Backfill legacy daily routes that stored vehicle only on the crew, or that have extra/missing employees vs the linked crew.

Daily routes can be created from the Daily routes workspace, or when assigning appointments or invoice barcodes (choose an existing daily route, or open the add daily route form).

The system allows us to:

- Group appointments and deliveries by route crew
- Assign routes to workers
- Order and sequence appointments
- Order deliveries
- Organize stops efficiently
- Track route activity and performance

This section helps coordinate the day-to-day movement of employees and merchandise.

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

Daily Income is used to manage and record the company's daily incoming transactions.

It provides a way to record and track income received each day and maintain a historical record of daily revenue.

**Register inventory change** (after Register income) records company supplies on the closeout: **received** (choose a supplier) or **dispatched** (choose an employee or daily route). Users pick an inventory item, quantity, and either unit price or total (the other amount updates automatically). Supplier, employee, and daily route can be created from the dropdown the same way sender/receiver can on invoices and appointments. The journal is posted as `transactionType: "INVENTORY"` with `inventoryDirection`. Received creates a receipt and posts an expense; dispatched creates a dispatch and posts sales. Journal and stock movement happen in one API transaction. Do not persist portal-only `assigneeSource`.

A journal can be posted under an **employee** `{ id, name }` **or** a **daily vehicle-route** `{ id, name, route?: { id, name } }` (same shape as invoice `receivedBy`). The portal picker uses a local `assigneeSource` (`employee` | `route`) so the form can choose which of those to save; do **not** persist that discriminator.

API assignee rules (`POST` / `PUT` `/v1/journals`):

- Accept **either** `employee` **or** a daily vehicle-route (`vehicleRoute`, `route`, and legacy `employeeGroup`).
- Discriminate by id shape: numeric id → employee; 24-char Mongo ObjectID → daily route.
- Normalize writes to one assignee family:
  - employee journals keep `employee` and clear `vehicleRoute` / `route` / `employeeGroup`
  - route journals keep `vehicleRoute`, `route`, and compatibility `employeeGroup`, with `employee` cleared
- Responses and searchable fields include the route assignee fields.

### Checks

Checks manages invoice payments made by check.

CHECK or CHEQUE invoice payments (`INITIAL-PAYMENT` and `PAYMENT`) create an **outstanding check** and do **not** update the invoice `payment` / `balance`. The invoice payment is applied only when the check is marked **cleared**. Updating or deleting a cleared check reverses those invoice effects.

The Checks workspace lists those records so staff can search, edit, clear, or delete them. Each check stores:

- Check number
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

### Admin

Admin manages the company's system configuration and administrative information.

This includes:

- System settings
- Employees
- Users
- Roles and permissions
- **User Activity** (audit log of who did what across the system)
- Company configuration
- Other administrative controls

#### User Activity (Admin)

Replaces the legacy screen at `tenares.embarqueros.com` → `#menu/useractivities`.

Portal route: `/user-activities` (Admin sidebar). The portal is a **read-only consumer** of activities recorded by the API.

**Probe (api.embarqueros.com Swagger, 2026-09-11):** there is **no** user-activity / audit-log API yet.

- Swagger has **121** paths and tags for invoice, user, role, journal, income_statement, etc.
- **Zero** paths or tags for `user-activities`, `activities`, `audits`, or `audit-logs`
- Invoice models have **no** `activity` / `severity` fields
- Portal invoice “activity” timelines are **frontend-synthetic** (built from invoice create/payment/comment data) — not a system-wide audit log

Do not confuse:

| Concept | Means |
| --- | --- |
| Admin → User Activity | Company-wide audit of user actions (`origin` + entity `id`) |
| Invoice view → Activity | Per-invoice synthetic timeline in the portal only |

##### Backend TODO (adjusted: build from scratch)

Nothing to reuse for list/search of user activities. Implement the full surface:

1. **Data model** (every activity):
   - `timestamp` — when it occurred
   - `user` — who performed it (`id` + display name at minimum)
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

4. **Legacy alignment** — map historical user-activity rows into the new shape without dropping data:
   - timestamp / user / details → `timestamp` / `user` / `description`
   - legacy invoice (or similar) → `origin` + `id`
   - keep `quantity` when present
   - assign historical `severity` from action/type mapping
   - fallback origin (e.g. `legacy`) when classification is unclear; preserve leftover fields in description or metadata rather than discarding

5. **List API** (portal directory):
   - `GET /v1/user-activities` — paginated list (default sort `timestamp:desc`)
   - `POST /v1/user-activities/search` — Stripe-style search (user, description, origin, entity `id`, severity, date range)
   - Permission seed (recommended): `user_activity` / `canViewUserActivity` (portal currently gates with user view until seeded)
   - OpenAPI/Swagger docs for model + endpoints

6. **Portal** consumes severity for display only: common = default, uncommon = yellow, rare = red.

### Reports

Reports generates printable PDFs from operational records (pickup manifests, invoices, labels, income statements, journals, loans, and delivery manifests). The Reports workspace is the generate-and-download hub; print actions also live on those source workspaces.

The API only exposes generate endpoints (`POST /reports/{type}`) plus a public download (`GET /public/reports/{token}`). There is no list or CRUD collection of saved reports.

### Insights

Insights provides analytics and business intelligence that can help management improve operations and make better decisions.

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
