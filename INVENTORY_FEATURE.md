# Inventory Feature Specification

Design reference for EMSYS Portal inventory tracking. Stock levels are derived from a movement ledger (receipts, dispatches, and adjustments) rather than manual quantity edits.

---

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| Item directory (SKU catalog) | **Shipped (mock)** | `/inventory` — list, add, edit, delete, view sheet, filters, KPIs |
| Receipts / dispatches / adjustments | **Planned** | Data models and workflows below |
| Movement ledger | **Planned** | Source of truth for on-hand stock |
| EMSYS API integration | **Planned** | Replace `mock-data.ts` with TanStack Query hooks |

### Current portal (Phase 1)

The live UI is a warehouse SKU directory backed by in-memory mock data:

```
src/lib/inventory/
├── types.ts          # InventoryItem, filters, form values, status derivation
├── mock-data.ts      # MOCK_INVENTORY_ITEMS (12 sample SKUs)
└── display.ts        # Labels, KPIs, search, available-quantity helper

src/components/inventory/
├── inventory-workspace.tsx   # Directory table, filters, CRUD dialogs
├── inventory-item-form.tsx   # Add / edit form
└── inventory-view-sheet.tsx  # Read-only detail sheet
```

**`InventoryItem` (frontend, today)**

| Field | Type | Description |
| --- | --- | --- |
| `id` | string | Primary key |
| `sku` | string | Stock-keeping unit code |
| `name` | string | Display name |
| `category` | enum | `packaging` \| `labels` \| `supplies` \| `equipment` |
| `location` | enum | `ny_warehouse` \| `rd_warehouse` \| `in_transit` \| `dock` |
| `quantity` | number | On-hand count |
| `reserved` | number | Units held for outbound work |
| `reorderLevel` | number | Low-stock threshold |
| `unit` | string | Unit of measure (e.g. boxes, rolls) |
| `status` | enum | Derived: `in_stock` \| `low_stock` \| `out_of_stock` \| `reserved` \| `review` |
| `notes` | string? | Free text |
| `createdAt` / `updatedAt` | ISO datetime | Audit timestamps |
| `createdBy` | string | Audit user |

Status is derived by `deriveInventoryStatus(quantity, reserved, reorderLevel)` — not stored independently on create.

**Available quantity** = `max(quantity - reserved, 0)`.

Phase 1 does **not** yet enforce ledger-only stock changes. Quantities are editable directly in the form. Phase 2 replaces that with movement-driven balances.

---

## Target architecture (Phase 2)

### Design principles

1. **`InventoryMovement` is the ledger** — current stock per item is the sum of movements (IN − OUT ± ADJUSTMENT).
2. **Receipts and dispatches are documents** — each line item generates one movement on save/confirm.
3. **No manual quantity field on items** — corrections go through adjustments with a reason.
4. **Recipients are first-class** — customers, vendors, branches, or internal destinations for outbound stock.

### Data models

All entities use the `Inventory` prefix. Foreign keys reference the prefixed table names.

#### `InventoryItem`

| Column | Type | Notes |
| --- | --- | --- |
| `item_id` | PK | |
| `name` | string | e.g. Receipt, Invoice, Box, Small Barrel, Large Barrel |
| `category` | string | e.g. Stationery, Container |
| `unit_of_measure` | string | e.g. each, pack |
| `reorder_level` | integer | Triggers low-stock alerts |
| `created_at` | datetime | |

#### `InventoryRecipient`

| Column | Type | Notes |
| --- | --- | --- |
| `recipient_id` | PK | |
| `name` | string | |
| `type` | enum | `customer` \| `vendor` \| `branch` \| `internal` |
| `contact_info` | string | |
| `address` | string | |
| `created_at` | datetime | |

#### `InventoryMovement` (ledger — source of truth)

| Column | Type | Notes |
| --- | --- | --- |
| `movement_id` | PK | |
| `item_id` | FK → `InventoryItem` | |
| `direction` | enum | `IN` \| `OUT` \| `ADJUSTMENT` |
| `quantity` | integer | Always positive; direction encodes sign |
| `movement_date` | datetime | |
| `reference_type` | enum | `receipt` \| `dispatch` \| `adjustment` |
| `reference_id` | FK | → `InventoryReceipt`, `InventoryDispatch`, or adjustment record |
| `created_by` | string | |
| `notes` | text | |

**Current stock** for an item = `SUM(IN) − SUM(OUT) ± SUM(ADJUSTMENT)` — no separate balance column to update.

#### `InventoryReceipt` (stock in)

| Column | Type | Notes |
| --- | --- | --- |
| `receipt_id` | PK | |
| `receipt_date` | datetime | |
| `source` | string | Supplier name or `return` |
| `received_by` | string | |
| `notes` | text | |

#### `InventoryReceiptLine`

| Column | Type | Notes |
| --- | --- | --- |
| `receipt_line_id` | PK | |
| `receipt_id` | FK → `InventoryReceipt` | |
| `item_id` | FK → `InventoryItem` | |
| `quantity` | integer | |

#### `InventoryDispatch` (stock out)

| Column | Type | Notes |
| --- | --- | --- |
| `dispatch_id` | PK | |
| `dispatch_date` | datetime | |
| `recipient_id` | FK → `InventoryRecipient` | |
| `dispatched_by` | string | |
| `status` | enum | `pending` \| `sent` \| `confirmed` |
| `invoice_number` | string? | Optional link to billing |
| `notes` | text | |

#### `InventoryDispatchLine`

| Column | Type | Notes |
| --- | --- | --- |
| `dispatch_line_id` | PK | |
| `dispatch_id` | FK → `InventoryDispatch` | |
| `item_id` | FK → `InventoryItem` | |
| `quantity` | integer | |

### Entity relationships

```txt
InventoryItem
  ├── InventoryMovement (many)
  ├── InventoryReceiptLine (many)
  └── InventoryDispatchLine (many)

InventoryRecipient
  └── InventoryDispatch (many)

InventoryReceipt
  ├── InventoryReceiptLine (many)
  └── InventoryMovement (via reference_id, one per line on save)

InventoryDispatch
  ├── InventoryDispatchLine (many)
  └── InventoryMovement (via reference_id, one per line on send)
```

---

## Workflows

### IN — receiving stock

1. User selects **New Receipt**.
2. Enters source (supplier / return) and date.
3. Adds one or more line items — pick an `InventoryItem`, enter quantity.
4. Saves the receipt.
5. System creates one `InventoryMovement` per line (`direction = IN`, `reference_type = receipt`, `reference_id = receipt_id`).
6. Current stock updates automatically from the ledger sum.

### OUT — dispatching stock

1. User selects **New Dispatch**.
2. Picks a recipient (or creates one inline).
3. Adds line items — item + quantity.
4. System validates `current stock ≥ requested quantity` per line (block or warn if insufficient).
5. Saves with `status = pending`.
6. On send confirmation, `status → sent` and system creates one `InventoryMovement` per line (`direction = OUT`).
7. Optionally, recipient confirms receipt → `status → confirmed`.

### Adjustment — corrections, damage, recount

1. User selects **Adjust Stock**.
2. Picks item, enters +/- quantity and a reason.
3. System creates one `InventoryMovement` (`direction = ADJUSTMENT`, `reference_type = adjustment`).

---

## UI screens

### 1. Dashboard

- **Table columns:** Item | Current Stock | Reorder Level | Status (OK / Low)
- **Actions:** [New Receipt] [New Dispatch] [Adjust Stock]

Phase 1 already ships a directory table with KPI stat cards (Total SKUs, In stock, Low stock, Needs review). Phase 2 adds the three movement actions above.

### 2. New Receipt form

- **Header:** Date, Source, Received By
- **Lines:** Item dropdown | Quantity | Remove (add row)
- **Submit:** [Save Receipt]
- **On save:** Redirect to receipt detail (read-only; shows generated movement IDs)

### 3. New Dispatch form

- **Header:** Date, Recipient (dropdown + add new), Dispatched By, Invoice Number (optional)
- **Lines:** Item dropdown | Quantity | Available Stock (live) | Remove
- **Status:** Defaults to Pending
- **Submit:** [Save Dispatch] / [Save & Mark Sent]

### 4. Adjust Stock form

- **Fields:** Item dropdown, +/- Quantity, Reason (damaged / recount / lost / other), Notes
- **Submit:** [Submit Adjustment]

### 5. Item detail view

- Item info header
- **Tabs:** Movement History (ledger, filterable by date/type) | Receipts | Dispatches
- **Optional:** Stock level over time chart

Phase 1 ships a view sheet with stock, location, and audit fields. Tabs and movement history arrive in Phase 2.

### 6. Recipient detail view

- Recipient info header
- **Table:** Dispatch history — Date | Items | Quantities | Status | Invoice #

### 7. Reports

- **Filters:** Date range, item, recipient
- **Outputs:**
  - Stock on hand as of date
  - Dispatch summary by recipient
  - Low stock alert list

---

## Frontend integration plan

When EMSYS API endpoints exist, follow portal architecture conventions:

```
src/lib/inventory/
├── api/              # Axios calls via central client
├── hooks/            # TanStack Query (useInventoryItems, useReceipts, …)
├── schemas/          # Zod validation for forms
├── types/            # Shared TS types aligned with API
└── utils/            # Stock calculations, status derivation
```

- Server state → TanStack Query only (never Redux).
- Forms → React Hook Form + Zod.
- Dropdowns → `SearchableSelect`.
- User-facing strings → `src/locales/en/inventory.json` and `src/locales/es/inventory.json`.
- Directory tables → `Card` with `gap-0`, `CardHeader` with `border-b py-4 pb-3` per workspace table rules.

### Suggested API surface

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/inventory/items` | List items with computed stock |
| `POST` | `/inventory/items` | Create catalog item |
| `GET` | `/inventory/movements` | Ledger history (filters) |
| `POST` | `/inventory/receipts` | Create receipt + IN movements |
| `GET` | `/inventory/receipts/:id` | Receipt detail |
| `POST` | `/inventory/dispatches` | Create dispatch |
| `PATCH` | `/inventory/dispatches/:id` | Update status (sent / confirmed) |
| `POST` | `/inventory/adjustments` | Create adjustment movement |
| `GET` | `/inventory/recipients` | List recipients |
| `POST` | `/inventory/recipients` | Create recipient |
| `GET` | `/inventory/reports/stock` | Stock-on-hand report |
| `GET` | `/inventory/reports/dispatches` | Dispatch summary |

Exact paths depend on EMSYS API design; align `src/lib/api/endpoints.ts` when backend is finalized.

---

## Migration from Phase 1 → Phase 2

1. Add `sku`, `location`, and `reserved` to `InventoryItem` API model (or map from existing fields).
2. Replace direct `quantity` edits in the item form with read-only computed stock.
3. Seed initial movements from Phase 1 quantities (one-time `ADJUSTMENT` per item) or accept a cutover date.
4. Wire receipt/dispatch/adjustment flows to create movements atomically with their parent documents.
5. Extend the view sheet with Movement History tab backed by `GET /inventory/movements?item_id=…`.

---

_Update this document when API contracts or UI scope change._
