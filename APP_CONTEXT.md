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

**Received by** (`receivedBy`) is who took in the merchandise. It replaces legacy `employee` (`core.User`). The value is either:

- the selected **warehouse/office employee**, or
- the selected **daily route** (vehicle-route). Display the nested route-crew name when the daily route has one.

It is not the system user who digitized the invoice (`createdBy`).

TODO (backend) — invoice received-by (portal now follows this; align API + legacy data):

Replace invoice **`employee`** (`core.User`) with **`receivedBy`**. Discriminate with **`pickupSource`** (`route` | `warehouse` | `office`):

- **Route:** `receivedBy` is the selected daily vehicle-route (`id` + `name`) with nested crew ref `route` (`id` + `name`).
- **Warehouse / office:** `receivedBy` is the selected employee (`id` + `name`; keep `fullName` / `userName` when present). Also persist **`officeBranch`** (`id` + `code` + `name`).

Keep **`createdBy`** as the user who digitized the invoice. Do not keep using `employee` as Received by. On update, `receivedBy` must replace the previous value (do not leave a leftover User on route invoices or a leftover daily route on employee invoices).

Backfill legacy invoices: when `employee` is a `core.User` and there is no daily route, copy it onto `receivedBy` and set `pickupSource` to `warehouse` or `office`. When the invoice was received on a route, set `receivedBy` to the daily vehicle-route (resolve from `route` / `vehicleRoute` if needed, including nested `route` crew) and set `pickupSource: route`. After backfill, stop treating `employee` as Received by.

### Barcodes

Barcodes are used to identify and track individual items within invoices.

The system manages the barcode/label assigned to each item, allowing us to track specific merchandise throughout the shipping process.

Barcodes can be used to:

- Identify individual items
- Track item status
- Associate items with invoices
- Track movement through our operations
- Update item status through scanning

### Barcode Scanner

The barcode scanner provides a quick way to scan an item's barcode and update its status.

This allows workers to efficiently process merchandise as it moves through different stages of our operation without having to manually search for each item.

### Inventory

Inventory manages the company's internal supplies and materials.

It is separate from customer merchandise and is used to:

- Track supplies
- Monitor stock levels
- Record inventory movements
- Identify items that need to be replenished
- Maintain inventory history

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

### Checks

Checks manages checks received or issued by the company.

The system tracks:

- Check information
- Amount
- Date
- Associated transaction
- Status
- Historical records

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

### Admin

Admin manages the company's system configuration and administrative information.

This includes:

- System settings
- Employees
- Users
- Roles and permissions
- Company configuration
- Other administrative controls

### Insights

Insights provides analytics and business intelligence that can help management improve operations and make better decisions.

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
