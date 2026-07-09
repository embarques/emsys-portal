# Inventory — Backend API & Data Model Specification

Handoff document for the EMSYS API / backend team. Defines the data models, business rules, and REST endpoints required to replace the portal's in-memory inventory mock store with real API integration.

**Related docs**

| Document | Purpose |
| --- | --- |
| `INVENTORY_FEATURE.md` | Product design, UI screens, migration plan |
| `API_PAYLOADS.md` | Global EMSYS API conventions (envelope, headers, camelCase) |
| `src/lib/inventory/types/` | Portal TypeScript types the client will map from API responses |
| `src/lib/inventory/mock-store.ts` | Reference implementation of business rules (mock) |

**Portal status:** Full inventory UI is implemented against mock data. The client is ready to swap `mock-store` calls for Axios + TanStack Query once endpoints exist.

---

## Summary

Inventory tracks warehouse stock through a **movement ledger**. Catalog items (SKUs) do not store on-hand quantity directly — stock is computed from movements:

```txt
onHand = SUM(IN) − SUM(OUT) ± SUM(ADJUSTMENT)
```

Receipts, dispatches, and adjustments are **documents** that create ledger movements atomically. Recipients are first-class entities for outbound stock.

All resources are **company-scoped** (same tenant model as customers, vehicles, etc.).

---

## Global conventions

Follow existing EMSYS API patterns documented in `API_PAYLOADS.md`.

| Concern | Value |
| --- | --- |
| Base path | `/v1` |
| Resource prefix | `/inventory/...` |
| JSON field names | camelCase |
| Primary keys | MongoDB ObjectID (24-char hex) for all inventory entities |
| Auth headers | `Authorization: Bearer <firebase_jwt>`, `X-Company-ID: <company_id>` |
| List pagination | `page`, `limit`, `offset`, `sort` query params |
| Filtered search | `POST /inventory/<resource>/search` (Stripe-style filter body, same as customers/vehicles) |
| Success envelope | `{ success, message, data, meta?, page?, resultsPerPage?, total? }` |
| Write bodies | Send the resource object directly — do **not** wrap in `{ data: … }` |

---

## Architecture principles

1. **`InventoryMovement` is the ledger** — never update a balance column on the item row.
2. **Receipts create IN movements on save** — one movement per line, in the same transaction.
3. **Dispatches may be pending** — OUT movements are created only when status becomes `sent` (on create with `markSent: true`, or via status update).
4. **Adjustments always create one ADJUSTMENT movement** — corrections, damage, recounts, opening balances.
5. **Catalog fields are editable; stock is read-only** — `quantity` / `status` are computed at read time.
6. **`reserved` is a catalog hold** — subtracted from available stock but not part of the movement ledger (future: link to orders/dispatches).

---

## Permissions

The portal currently gates inventory routes with a placeholder permission (`canViewDelivery`). Backend should seed dedicated inventory permissions:

| Permission | Suggested name | Actions |
| --- | --- | --- |
| View inventory | `canViewInventory` | All GET/list/search/report endpoints |
| Create inventory | `canCreateInventory` | POST items, receipts, dispatches, adjustments, recipients |
| Update inventory | `canUpdateInventory` | PUT items, recipients; PATCH dispatch status |
| Delete inventory | `canDeleteInventory` | DELETE items, recipients |

Resource type suggestion: `inventory`.

---

## Enumerations

### `InventoryCategory`

| Value | Description |
| --- | --- |
| `packaging` | Boxes, mailers, wrap |
| `labels` | Label stock and rolls |
| `supplies` | Consumables |
| `equipment` | Scanners, scales, etc. |

### `InventoryLocation`

| Value | Description |
| --- | --- |
| `ny_warehouse` | NY warehouse |
| `rd_warehouse` | RD warehouse |
| `in_transit` | In transit between sites |
| `dock` | Loading dock |

### `InventoryStatus` (computed — not stored)

| Value | Derivation rule |
| --- | --- |
| `out_of_stock` | `onHand <= 0` |
| `reserved` | `reserved >= onHand` (and `onHand > 0`) |
| `low_stock` | `onHand - reserved <= reorderLevel` |
| `in_stock` | otherwise |

Evaluation order matters — check `out_of_stock` first, then `reserved`, then `low_stock`.

### `MovementDirection`

| Value | Effect on stock |
| --- | --- |
| `IN` | `+quantity` |
| `OUT` | `−quantity` |
| `ADJUSTMENT` | `±quantity` (see `adjustmentSign`) |

### `MovementReferenceType`

| Value | Parent document |
| --- | --- |
| `receipt` | `InventoryReceipt` |
| `dispatch` | `InventoryDispatch` |
| `adjustment` | `InventoryAdjustment` |

### `AdjustmentSign`

| Value | Effect |
| --- | --- |
| `increase` | `+quantity` |
| `decrease` | `−quantity` |

### `AdjustmentReason`

| Value |
| --- |
| `damaged` |
| `recount` |
| `lost` |
| `other` |

### `DispatchStatus`

| Value | Movements created? |
| --- | --- |
| `pending` | No — draft only |
| `sent` | Yes — OUT movements per line |
| `confirmed` | No additional movements (acknowledgement) |

Allowed transitions: `pending → sent → confirmed`. Reject transitions that would double-post movements (e.g. `sent → pending`).

### `RecipientType`

| Value |
| --- |
| `customer` |
| `vendor` |
| `branch` |
| `internal` |

---

## Data models

### `InventoryItem` (catalog)

Physical table suggestion: `inventory_items`.

| Field | DB type | Required | Notes |
| --- | --- | --- | --- |
| `id` | ObjectID | PK | Server-generated on create |
| `companyId` | ObjectID | FK | Tenant scope |
| `sku` | string | yes | Unique per company |
| `name` | string | yes | Display name |
| `category` | enum | yes | `InventoryCategory` |
| `location` | enum | yes | `InventoryLocation` |
| `unit` | string | yes | Unit of measure (e.g. `boxes`, `rolls`) |
| `reorderLevel` | integer | yes | `>= 0` |
| `reserved` | integer | yes | `>= 0`; units held for outbound work |
| `notes` | text | no | |
| `createdAt` | datetime | yes | ISO 8601 |
| `createdBy` | string | yes | Display name or user ref |
| `createdById` | uint16? | no | EMSYS user id if available |
| `updatedAt` | datetime | yes | |

**Not stored on item:** `quantity`, `status`, `availableQuantity` — computed at read time from movements.

**Indexes:** `(companyId, sku)` unique; `(companyId, category)`; `(companyId, location)`.

#### API read shape (`InventoryItem`)

Includes computed fields for list/detail responses:

```json
{
  "id": "674a1b2c3d4e5f6789012345",
  "sku": "PKG-BOX-M",
  "name": "Medium shipping boxes (18x12x10)",
  "category": "packaging",
  "location": "ny_warehouse",
  "unit": "boxes",
  "reorderLevel": 100,
  "reserved": 48,
  "notes": "Primary outbound carton for domestic routes.",
  "quantity": 420,
  "availableQuantity": 372,
  "status": "in_stock",
  "createdAt": "2026-06-04T14:22:00Z",
  "createdBy": "Hector Mejia",
  "updatedAt": "2026-06-04T14:22:00Z"
}
```

Where:

- `quantity` = on-hand from ledger
- `availableQuantity` = `max(quantity - reserved, 0)`
- `status` = derived per rules above

---

### `InventoryRecipient`

Physical table suggestion: `inventory_recipients`.

| Field | DB type | Required | Notes |
| --- | --- | --- | --- |
| `id` | ObjectID | PK | |
| `companyId` | ObjectID | FK | |
| `name` | string | yes | |
| `type` | enum | yes | `RecipientType` |
| `contactInfo` | string | no | Email or phone |
| `address` | string | no | |
| `createdAt` | datetime | yes | |

**Indexes:** `(companyId, name)`; `(companyId, type)`.

---

### `InventoryMovement` (ledger)

Physical table suggestion: `inventory_movements`. **Append-only** — no updates or deletes in normal operation.

| Field | DB type | Required | Notes |
| --- | --- | --- | --- |
| `id` | ObjectID | PK | |
| `companyId` | ObjectID | FK | |
| `itemId` | ObjectID | FK | → `inventory_items` |
| `direction` | enum | yes | `IN` \| `OUT` \| `ADJUSTMENT` |
| `quantity` | integer | yes | Always positive |
| `adjustmentSign` | enum | conditional | Required when `direction = ADJUSTMENT` |
| `movementDate` | datetime | yes | Business date of the movement |
| `referenceType` | enum | yes | `receipt` \| `dispatch` \| `adjustment` |
| `referenceId` | ObjectID | yes | Parent document id |
| `createdBy` | string | yes | |
| `createdById` | uint16? | no | |
| `notes` | text | no | |
| `createdAt` | datetime | yes | Record insert time |

**Indexes:** `(companyId, itemId, movementDate)`; `(companyId, referenceType, referenceId)`; `(companyId, movementDate)`.

**Stock calculation (per item):**

```sql
-- Pseudocode
SUM(CASE
  WHEN direction = 'IN' THEN quantity
  WHEN direction = 'OUT' THEN -quantity
  WHEN direction = 'ADJUSTMENT' AND adjustmentSign = 'increase' THEN quantity
  WHEN direction = 'ADJUSTMENT' AND adjustmentSign = 'decrease' THEN -quantity
END)
```

For **stock as of date** reports, filter `movementDate <= asOf` before summing.

---

### `InventoryReceipt`

Physical table suggestion: `inventory_receipts`.

| Field | DB type | Required | Notes |
| --- | --- | --- | --- |
| `id` | ObjectID | PK | |
| `companyId` | ObjectID | FK | |
| `receiptDate` | datetime | yes | |
| `source` | string | yes | Supplier name or `return` |
| `receivedBy` | string | yes | |
| `notes` | text | no | |
| `createdAt` | datetime | yes | |

#### `InventoryReceiptLine`

Physical table suggestion: `inventory_receipt_lines`.

| Field | DB type | Required | Notes |
| --- | --- | --- | --- |
| `id` | ObjectID | PK | |
| `receiptId` | ObjectID | FK | |
| `itemId` | ObjectID | FK | |
| `quantity` | integer | yes | `> 0` |

**On create:** Insert receipt + lines + one `IN` movement per line in a **single transaction**.

---

### `InventoryDispatch`

Physical table suggestion: `inventory_dispatches`.

| Field | DB type | Required | Notes |
| --- | --- | --- | --- |
| `id` | ObjectID | PK | |
| `companyId` | ObjectID | FK | |
| `dispatchDate` | datetime | yes | |
| `recipientId` | ObjectID | FK | → `inventory_recipients` |
| `dispatchedBy` | string | yes | |
| `status` | enum | yes | Default `pending` |
| `invoiceNumber` | string | no | Optional billing link |
| `notes` | text | no | |
| `createdAt` | datetime | yes | |

#### `InventoryDispatchLine`

Physical table suggestion: `inventory_dispatch_lines`.

| Field | DB type | Required | Notes |
| --- | --- | --- | --- |
| `id` | ObjectID | PK | |
| `dispatchId` | ObjectID | FK | |
| `itemId` | ObjectID | FK | |
| `quantity` | integer | yes | `> 0` |

**On create with `status = sent` (or `markSent: true`):** Validate stock, insert dispatch + lines + OUT movements atomically.

**On `pending → sent` transition:** Validate stock, insert OUT movements atomically. Reject if insufficient stock.

---

### `InventoryAdjustment`

Physical table suggestion: `inventory_adjustments`.

| Field | DB type | Required | Notes |
| --- | --- | --- | --- |
| `id` | ObjectID | PK | |
| `companyId` | ObjectID | FK | |
| `itemId` | ObjectID | FK | |
| `adjustmentSign` | enum | yes | `increase` \| `decrease` |
| `quantity` | integer | yes | `> 0` |
| `reason` | enum | yes | `AdjustmentReason` |
| `notes` | text | no | |
| `movementDate` | datetime | yes | |
| `createdBy` | string | yes | |
| `createdAt` | datetime | yes | |

**On create:** Insert adjustment + one `ADJUSTMENT` movement (`referenceType = adjustment`, `referenceId = adjustment.id`) atomically.

**Decrease validation:** Reject if result would drive on-hand below zero (unless product explicitly allows negative stock — portal assumes no).

---

## Entity relationships

```txt
InventoryItem
  ├── InventoryMovement (many)
  ├── InventoryReceiptLine (many)
  ├── InventoryDispatchLine (many)
  └── InventoryAdjustment (many)

InventoryRecipient
  └── InventoryDispatch (many)

InventoryReceipt
  ├── InventoryReceiptLine (many)
  └── InventoryMovement (one per line, on save)

InventoryDispatch
  ├── InventoryDispatchLine (many)
  └── InventoryMovement (one per line, when status = sent)

InventoryAdjustment
  └── InventoryMovement (one, on save)
```

---

## API endpoints

All paths are relative to `/v1`. Methods and shapes below match what the portal mock layer implements today.

### Items (catalog)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/inventory/items` | Paginated list with computed `quantity`, `status` |
| `POST` | `/inventory/items/search` | Filtered/sorted search (Stripe-style body) |
| `GET` | `/inventory/items/:id` | Item detail with computed stock |
| `POST` | `/inventory/items` | Create catalog item |
| `PUT` | `/inventory/items/:id` | Update catalog fields (not stock) |
| `DELETE` | `/inventory/items/:id` | Delete item |

#### `GET /inventory/items` query params

| Param | Type | Default | Notes |
| --- | --- | --- | --- |
| `page` | int | `1` | |
| `limit` | int | `50` | |
| `offset` | int | | Alternative to page |
| `sort` | string | `name:asc` | e.g. `sku:asc`, `quantity:desc` |

Optional filter query params (if not using POST search): `status`, `location`, `category`, `q` (text search on sku/name).

#### `POST /inventory/items` request

```json
{
  "sku": "PKG-BOX-M",
  "name": "Medium shipping boxes (18x12x10)",
  "category": "packaging",
  "location": "ny_warehouse",
  "unit": "boxes",
  "reorderLevel": 100,
  "reserved": 0,
  "notes": ""
}
```

Response `data`: full `InventoryItem` with `quantity: 0`, `status: "out_of_stock"`.

#### `PUT /inventory/items/:id` request

Same fields as create (all editable except stock). `sku` uniqueness enforced per company.

#### `DELETE /inventory/items/:id`

- Reject if item has movements (recommended) **or** cascade-delete movements (not recommended).
- Portal bulk-deletes by calling DELETE per id.

---

### Stock (computed)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/inventory/items/:id/stock` | Current on-hand for one item |

#### Response

```json
{
  "success": true,
  "data": {
    "itemId": "674a1b2c3d4e5f6789012345",
    "quantity": 420,
    "availableQuantity": 372,
    "reserved": 48
  }
}
```

Optional: include stock in list/detail responses (preferred) so the portal does not need a separate call per row.

---

### Movements (ledger)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/inventory/movements` | Paginated ledger history |
| `POST` | `/inventory/movements/search` | Filtered search |

#### Query / filter params

| Param | Type | Notes |
| --- | --- | --- |
| `itemId` | ObjectID | Filter by item |
| `direction` | enum | `IN`, `OUT`, `ADJUSTMENT` |
| `referenceType` | enum | `receipt`, `dispatch`, `adjustment` |
| `referenceId` | ObjectID | |
| `fromDate` | ISO date | Inclusive |
| `toDate` | ISO date | Inclusive |
| `q` | string | Search notes / createdBy |

#### Response item shape

```json
{
  "id": "674a1b2c3d4e5f6789012346",
  "itemId": "674a1b2c3d4e5f6789012345",
  "direction": "IN",
  "quantity": 12,
  "movementDate": "2026-06-03T10:00:00Z",
  "referenceType": "receipt",
  "referenceId": "674a1b2c3d4e5f6789012347",
  "createdBy": "Hector Mejia",
  "notes": "Restock of label supplies",
  "createdAt": "2026-06-03T10:05:00Z"
}
```

For `ADJUSTMENT` direction, include `adjustmentSign`.

**Read-only** — movements are created only via receipt/dispatch/adjustment endpoints.

---

### Receipts

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/inventory/receipts` | Paginated list |
| `POST` | `/inventory/receipts/search` | Filtered search |
| `GET` | `/inventory/receipts/:id` | Detail with lines + movements |
| `POST` | `/inventory/receipts` | Create receipt + lines + IN movements |

#### `POST /inventory/receipts` request

```json
{
  "receiptDate": "2026-06-03T10:00:00Z",
  "source": "PackRight Supplies",
  "receivedBy": "Hector Mejia",
  "notes": "Restock of label supplies",
  "lines": [
    { "itemId": "674a1b2c3d4e5f6789012345", "quantity": 12 },
    { "itemId": "674a1b2c3d4e5f6789012348", "quantity": 24 }
  ]
}
```

Validation:

- At least one line required.
- Each `quantity > 0`.
- All `itemId` values must exist for the company.

#### `GET /inventory/receipts/:id` response `data`

```json
{
  "id": "674a1b2c3d4e5f6789012347",
  "receiptDate": "2026-06-03T10:00:00Z",
  "source": "PackRight Supplies",
  "receivedBy": "Hector Mejia",
  "notes": "Restock of label supplies",
  "createdAt": "2026-06-03T10:05:00Z",
  "lines": [
    {
      "id": "674a1b2c3d4e5f6789012349",
      "receiptId": "674a1b2c3d4e5f6789012347",
      "itemId": "674a1b2c3d4e5f6789012345",
      "quantity": 12
    }
  ],
  "movements": [ "/* InventoryMovement[] for this receipt */" ]
}
```

Receipts are **immutable** after create (no PUT/DELETE in v1).

---

### Dispatches

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/inventory/dispatches` | Paginated list |
| `POST` | `/inventory/dispatches/search` | Filtered search |
| `GET` | `/inventory/dispatches/:id` | Detail with lines (+ movements if sent) |
| `POST` | `/inventory/dispatches` | Create dispatch |
| `PATCH` | `/inventory/dispatches/:id/status` | Transition status |

#### `POST /inventory/dispatches` request

```json
{
  "dispatchDate": "2026-06-04T14:00:00Z",
  "recipientId": "674a1b2c3d4e5f6789012350",
  "dispatchedBy": "Hector Mejia",
  "invoiceNumber": "INV-2026-0412",
  "notes": "Weekly replenishment",
  "markSent": false,
  "lines": [
    { "itemId": "674a1b2c3d4e5f6789012345", "quantity": 48 },
    { "itemId": "674a1b2c3d4e5f6789012348", "quantity": 6 }
  ]
}
```

| Field | Notes |
| --- | --- |
| `markSent` | If `true`, create with `status: sent` and post OUT movements immediately |
| `markSent: false` | Create with `status: pending`; no movements yet |

Validation when posting movements (`markSent: true` or later status change to `sent`):

- For each line: `availableQuantity >= line.quantity`
- Return `409` or `422` with item name/sku in error message on insufficient stock.

#### `PATCH /inventory/dispatches/:id/status` request

```json
{
  "status": "sent"
}
```

Allowed values: `sent`, `confirmed`.

- `pending → sent`: validate stock, create OUT movements.
- `sent → confirmed`: status update only.
- Reject all other transitions with `422`.

#### `GET /inventory/dispatches/:id` response `data`

Same pattern as receipts: header + `lines[]` + `movements[]` (empty if pending).

---

### Adjustments

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/inventory/adjustments` | Paginated list (optional for v1) |
| `GET` | `/inventory/adjustments/:id` | Detail (optional for v1) |
| `POST` | `/inventory/adjustments` | Create adjustment + movement |

#### `POST /inventory/adjustments` request

```json
{
  "itemId": "674a1b2c3d4e5f6789012345",
  "adjustmentSign": "decrease",
  "quantity": 5,
  "reason": "damaged",
  "notes": "Water damage in dock area",
  "movementDate": "2026-06-04T16:30:00Z",
  "createdBy": "Hector Mejia"
}
```

Response `data`: created `InventoryAdjustment` record.

Adjustments are **immutable** after create.

---

### Recipients

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/inventory/recipients` | Paginated list |
| `POST` | `/inventory/recipients/search` | Filtered search |
| `GET` | `/inventory/recipients/:id` | Detail with dispatch history (optional embed) |
| `POST` | `/inventory/recipients` | Create |
| `PUT` | `/inventory/recipients/:id` | Update |
| `DELETE` | `/inventory/recipients/:id` | Delete |

#### `POST /inventory/recipients` request

```json
{
  "name": "Acme Logistics",
  "type": "customer",
  "contactInfo": "ops@acmelogistics.com",
  "address": "1200 Harbor Blvd, Newark, NJ"
}
```

#### `DELETE /inventory/recipients/:id`

Reject if recipient is referenced by any dispatch (recommended).

---

### Reports

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/inventory/reports/stock-on-hand` | Stock levels as of a date |
| `GET` | `/inventory/reports/dispatches` | Dispatch summary by recipient |
| `GET` | `/inventory/reports/low-stock` | Items at or below reorder level |

#### `GET /inventory/reports/stock-on-hand`

| Query param | Type | Notes |
| --- | --- | --- |
| `asOf` | ISO date | Default: today (end of day UTC) |
| `itemId` | ObjectID | Optional filter |

Response `data`:

```json
{
  "asOf": "2026-06-04",
  "items": [
    {
      "itemId": "674a1b2c3d4e5f6789012345",
      "sku": "PKG-BOX-M",
      "name": "Medium shipping boxes",
      "quantity": 420,
      "unit": "boxes",
      "reorderLevel": 100,
      "status": "in_stock"
    }
  ]
}
```

Compute `quantity` using movements where `movementDate <= asOf end-of-day`.

#### `GET /inventory/reports/dispatches`

| Query param | Type | Notes |
| --- | --- | --- |
| `asOf` | ISO date | Include dispatches with `dispatchDate <= asOf` |
| `itemId` | ObjectID | Optional — only count lines for this item |
| `recipientId` | ObjectID | Optional |

Response `data`:

```json
{
  "asOf": "2026-06-04",
  "summary": [
    {
      "recipientId": "674a1b2c3d4e5f6789012350",
      "recipientName": "Acme Logistics",
      "dispatchCount": 3,
      "totalQuantity": 156
    }
  ]
}
```

#### `GET /inventory/reports/low-stock`

Returns items where `availableQuantity <= reorderLevel` (current stock, not historical).

---

## Business rules & validation

| Rule | Behavior |
| --- | --- |
| SKU uniqueness | Unique per `companyId` |
| Line quantities | Must be integers `> 0` |
| Stock on dispatch | Block when `availableQuantity < requested` at movement post time |
| Negative stock | Reject decreases that would result in `onHand < 0` |
| Atomic writes | Receipt/dispatch/adjustment + movements in one DB transaction |
| Movement immutability | No PUT/DELETE on movements |
| Dispatch double-post | Never create OUT movements twice for the same dispatch |
| `reserved` | Editable on item; does not affect ledger; reduces `availableQuantity` only |
| Delete item | Reject if any movements exist (recommended) |
| Delete recipient | Reject if referenced by dispatches |

---

## Error responses

Use standard EMSYS error envelope. Suggested HTTP status codes:

| Status | Scenario |
| --- | --- |
| `400` | Malformed body, missing required fields |
| `404` | Resource not found (wrong id or wrong company) |
| `409` | SKU duplicate, delete blocked by references |
| `422` | Business rule violation (insufficient stock, invalid status transition) |

Insufficient stock example:

```json
{
  "success": false,
  "message": "Insufficient stock",
  "error": "Insufficient stock for Medium shipping boxes (18x12x10): requested 48, available 32"
}
```

---

## Migration & seeding

When moving from Phase 1 mock data or legacy quantity fields:

1. Create catalog items without `quantity`.
2. Post one `ADJUSTMENT` / `increase` per item with `reason: recount` and `notes: "Opening balance migration"` to seed the ledger.
3. Optionally set `movementDate` to a agreed cutover date.

Portal reference: `mock-store.ts` → `buildOpeningMovements()`.

---

## Portal integration checklist

When endpoints are available, the frontend team will:

1. Add constants to `src/lib/api/endpoints.ts`.
2. Create `src/lib/inventory/api/inventory-api.ts` with mappers (API ↔ portal types).
3. Replace `mock-store` calls in `src/lib/inventory/hooks/use-inventory.ts` with TanStack Query + Axios.
4. Add Zod schemas under `src/lib/inventory/schemas/`.
5. Register `canViewInventory` (etc.) in `src/lib/auth/permissions.ts`.
6. Remove `src/lib/inventory/mock-store.ts` once API is stable.

**Types to align** (already defined in portal):

| Portal type | File |
| --- | --- |
| `InventoryCatalogItem`, `InventoryItem` | `types/catalog.ts` |
| `InventoryMovement`, `InventoryAdjustment` | `types/movements.ts` |
| `InventoryReceipt`, `InventoryDispatch` | `types/documents.ts` |
| `InventoryRecipient` | `types/recipients.ts` |

---

## Open questions for backend

1. **User references** — Should `createdBy` / `receivedBy` / `dispatchedBy` be display strings only, or structured `{ id, name }` user refs?
2. **Branch scoping** — Should inventory be filtered by branch in addition to company, or company-wide only?
3. **Negative stock** — Allow or hard-block on adjustments/decreases?
4. **Dispatch edits** — Can pending dispatches be edited (lines/qty), or create-only in v1?
5. **Invoice link** — Should `invoiceNumber` be a foreign key to the invoices module eventually?
6. **Reserved automation** — Future: should `reserved` auto-increment when dispatch is `pending`?

---

## Endpoint summary (quick reference)

```txt
GET    /v1/inventory/items
POST   /v1/inventory/items/search
GET    /v1/inventory/items/:id
POST   /v1/inventory/items
PUT    /v1/inventory/items/:id
DELETE /v1/inventory/items/:id
GET    /v1/inventory/items/:id/stock

GET    /v1/inventory/movements
POST   /v1/inventory/movements/search

GET    /v1/inventory/receipts
POST   /v1/inventory/receipts/search
GET    /v1/inventory/receipts/:id
POST   /v1/inventory/receipts

GET    /v1/inventory/dispatches
POST   /v1/inventory/dispatches/search
GET    /v1/inventory/dispatches/:id
POST   /v1/inventory/dispatches
PATCH  /v1/inventory/dispatches/:id/status

POST   /v1/inventory/adjustments
GET    /v1/inventory/adjustments          (optional v1)
GET    /v1/inventory/adjustments/:id      (optional v1)

GET    /v1/inventory/recipients
POST   /v1/inventory/recipients/search
GET    /v1/inventory/recipients/:id
POST   /v1/inventory/recipients
PUT    /v1/inventory/recipients/:id
DELETE /v1/inventory/recipients/:id

GET    /v1/inventory/reports/stock-on-hand
GET    /v1/inventory/reports/dispatches
GET    /v1/inventory/reports/low-stock
```

---

_Update this document when API contracts are finalized or portal requirements change._
