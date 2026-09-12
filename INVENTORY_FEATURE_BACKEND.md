# Inventory — Backend data models & permissions

Handoff for EMSYS API. Matches the **current portal** (`src/lib/inventory/types/`), not the older SKU / recipient / line-item design.

Inventory is the company’s **internal supplies**, not customer merchandise.

Company-scoped via `x-company-id`. Follow `API_PAYLOADS.md` (camelCase, success envelope, Mongo ObjectIDs).

---

## Tables

| Table | Resource type | Purpose |
| --- | --- | --- |
| `inventory_items` | `inventory_item` | Catalog (name + reorder threshold) |
| `inventory_stock` | `inventory_stock` | On-hand projection, 1:1 with item |
| `inventory_receipts` | `inventory_receipt` | Stock in (received) |
| `inventory_dispatches` | `inventory_dispatch` | Stock out (dispatched) |
| `inventory_suppliers` | `inventory_supplier` | Vendors for receipts |

**Do not persist `quantity` / `averageCost` on the item catalog.** Maintain them on `inventory_stock` (or compute on read from receipts − dispatches). Clients must not write stock quantity directly.

Recommended: also keep an append-only `inventory_movements` ledger internally (one IN per receipt, one OUT per dispatch). Not a user-facing resource.

Every table below includes:

```txt
createdAt   ISO 8601
createdBy   { id, name }   // core.User — set from session, not the request body
updatedAt   ISO 8601
updatedBy   { id, name }   // core.User — set from session on every write
```

On create, `updatedAt` / `updatedBy` equal `createdAt` / `createdBy`.

Shared user ref:

```json
{ "id": "42", "name": "Hector Mejia" }
```

---

## 1. Inventory item (`inventory_items`)

Catalog only. Creating an item also creates its `inventory_stock` row at quantity `0`, average cost `0`.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | ObjectID | PK | Server-generated |
| `companyId` | ObjectID | yes | Tenant |
| `item` | string | yes | Display name. Unique per company (case-insensitive) |
| `reorderThreshold` | number | yes | `>= 0`. Low-stock threshold |
| `createdAt` | datetime | yes | |
| `createdBy` | `{ id, name }` | yes | |
| `updatedAt` | datetime | yes | |
| `updatedBy` | `{ id, name }` | yes | |

### Read shape

Include the stock projection so the Stock page does not need a second call:

```json
{
  "id": "674a1b2c3d4e5f6789012345",
  "item": "Medium boxes",
  "reorderThreshold": 80,
  "quantity": 420,
  "averageCost": 2.15,
  "createdAt": "2026-06-04T14:22:00Z",
  "createdBy": { "id": "42", "name": "Hector Mejia" },
  "updatedAt": "2026-06-04T14:22:00Z",
  "updatedBy": { "id": "42", "name": "Hector Mejia" }
}
```

`quantity` and `averageCost` are **read-only** (from `inventory_stock`).

### Write shape (create / update)

```json
{
  "item": "Medium boxes",
  "reorderThreshold": 80
}
```

PUT updates catalog fields only. Do not accept `quantity` or `averageCost`.

**Delete:** reject if the item is referenced by any receipt or dispatch.

---

## 2. Stock (`inventory_stock`)

One row per item. Backend maintains this when receipts/dispatches change.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | ObjectID | PK | May equal `itemId` |
| `companyId` | ObjectID | yes | |
| `itemId` | ObjectID | yes | Unique per company. FK → `inventory_items` |
| `quantity` | number | yes | Quantity left. `>= 0` |
| `averageCost` | number | yes | Weighted avg unit cost from receipts. `>= 0` |
| `createdAt` | datetime | yes | When the stock row was created (item create) |
| `createdBy` | `{ id, name }` | yes | Same as item create |
| `updatedAt` | datetime | yes | Last receipt/dispatch that changed stock |
| `updatedBy` | `{ id, name }` | yes | User of that last movement |

### Formulas

```txt
quantity     = SUM(receipt.quantity) − SUM(dispatch.quantity)
averageCost  = SUM(receipt.quantity × receipt.averageCost) / SUM(receipt.quantity)
               (0 if no receipts)
```

Reject a dispatch when `quantity requested > quantity left`.

### Read shape

```json
{
  "id": "674a1b2c3d4e5f6789012345",
  "itemId": "674a1b2c3d4e5f6789012345",
  "item": { "id": "674a1b2c3d4e5f6789012345", "item": "Medium boxes" },
  "quantity": 420,
  "averageCost": 2.15,
  "reorderThreshold": 80,
  "createdAt": "2026-06-04T14:22:00Z",
  "createdBy": { "id": "42", "name": "Hector Mejia" },
  "updatedAt": "2026-06-04T14:05:00Z",
  "updatedBy": { "id": "42", "name": "Hector Mejia" }
}
```

`reorderThreshold` is copied from the item for the Stock list.

**Writes:** do not expose client PUT of `quantity` / `averageCost`. Stock create/delete follows the item. Seed CRUD permissions anyway so roles can grant the Stock workspace.

---

## 3. Received / receipt (`inventory_receipts`)

One item per receipt (no line-item table).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | ObjectID | PK | |
| `companyId` | ObjectID | yes | |
| `itemId` | ObjectID | yes | FK → `inventory_items` |
| `quantity` | number | yes | `> 0` |
| `averageCost` | number | yes | Unit cost of this receipt. `>= 0` |
| `supplierId` | ObjectID | yes | FK → `inventory_suppliers` |
| `receivedAt` | date | yes | Business date received (`YYYY-MM-DD`) |
| `createdAt` | datetime | yes | When the record was saved |
| `createdBy` | `{ id, name }` | yes | |
| `updatedAt` | datetime | yes | |
| `updatedBy` | `{ id, name }` | yes | |

**On create / update / delete:** in the same transaction, update `inventory_stock` (and append/rewrite the IN movement if you keep a ledger). Recalculate weighted `averageCost` for that item.

### Write shape

```json
{
  "itemId": "674a1b2c3d4e5f6789012345",
  "quantity": 12,
  "averageCost": 18.5,
  "supplierId": "674a1b2c3d4e5f6789012346",
  "receivedAt": "2026-06-03"
}
```

### Read shape

```json
{
  "id": "674a1b2c3d4e5f6789012347",
  "itemId": "674a1b2c3d4e5f6789012345",
  "item": { "id": "674a1b2c3d4e5f6789012345", "item": "Thermal labels" },
  "quantity": 12,
  "averageCost": 18.5,
  "supplierId": "674a1b2c3d4e5f6789012346",
  "supplier": { "id": "674a1b2c3d4e5f6789012346", "companyName": "PackRight Supplies" },
  "receivedAt": "2026-06-03",
  "createdAt": "2026-06-03T10:05:00Z",
  "createdBy": { "id": "42", "name": "Hector Mejia" },
  "updatedAt": "2026-06-03T10:05:00Z",
  "updatedBy": { "id": "42", "name": "Hector Mejia" }
}
```

**Update / delete:** recalc stock. Reject delete/update that would make `quantity left` negative because of existing dispatches.

---

## 4. Dispatched (`inventory_dispatches`)

One item per dispatch (no line-item table, no recipient, no pending/sent status).

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | ObjectID | PK | |
| `companyId` | ObjectID | yes | |
| `itemId` | ObjectID | yes | FK → `inventory_items` |
| `quantity` | number | yes | `> 0` |
| `incomeGained` | number | yes | Money from this dispatch. `>= 0` |
| `dispatchedAt` | date | yes | Business date dispatched (`YYYY-MM-DD`) |
| `dispatchedTo` | object | yes | Employee `{ id, name }` **or** daily vehicle-route `{ id, name, route?: { id, name } }` — same shape as invoice `receivedBy` |
| `createdAt` | datetime | yes | |
| `createdBy` | `{ id, name }` | yes | |
| `updatedAt` | datetime | yes | |
| `updatedBy` | `{ id, name }` | yes | |

**On create:** reject if `quantity > stock.quantity` for that item. Then decrement stock.

`dispatchedTo` is required. Discriminate employee vs daily route by shape (numeric employee `id` vs Mongo daily-route `id` / nested crew `route`). Do **not** persist a portal `assigneeSource` discriminator. On write, replace the previous assignee — do not leave leftover employee on route dispatches, or leftover route on employee dispatches.

### Write shape

```json
{
  "itemId": "674a1b2c3d4e5f6789012345",
  "quantity": 48,
  "incomeGained": 96,
  "dispatchedAt": "2026-06-04",
  "dispatchedTo": {
    "id": "674a1b2c3d4e5f6789012301",
    "name": "NY Pickup A",
    "route": { "id": "674a1b2c3d4e5f6789012302", "name": "Crew A" }
  }
}
```

Employee example:

```json
{
  "dispatchedTo": { "id": 12, "name": "Hector Mejia" }
}
```

### Read shape

```json
{
  "id": "674a1b2c3d4e5f6789012348",
  "itemId": "674a1b2c3d4e5f6789012345",
  "item": { "id": "674a1b2c3d4e5f6789012345", "item": "Medium boxes" },
  "quantity": 48,
  "incomeGained": 96,
  "dispatchedAt": "2026-06-04",
  "dispatchedTo": {
    "id": "674a1b2c3d4e5f6789012301",
    "name": "NY Pickup A",
    "route": { "id": "674a1b2c3d4e5f6789012302", "name": "Crew A" }
  },
  "createdAt": "2026-06-04T14:05:00Z",
  "createdBy": { "id": "42", "name": "Hector Mejia" },
  "updatedAt": "2026-06-04T14:05:00Z",
  "updatedBy": { "id": "42", "name": "Hector Mejia" }
}
```

Insufficient stock:

```json
{
  "success": false,
  "message": "Insufficient stock for Medium boxes: requested 48, available 32"
}
```

---

## 5. Supplier (`inventory_suppliers`)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | ObjectID | PK | |
| `companyId` | ObjectID | yes | |
| `companyName` | string | yes | Unique per company (case-insensitive) |
| `contactNames` | string[] | yes | Empty array allowed. Trim blanks |
| `addresses` | string[] | yes | Empty array allowed. Trim blanks |
| `phones` | `RecordPhone[]` | yes | Same phone shape as customers |
| `emails` | string[] | yes | Empty array allowed. Trim blanks |
| `createdAt` | datetime | yes | |
| `createdBy` | `{ id, name }` | yes | |
| `updatedAt` | datetime | yes | |
| `updatedBy` | `{ id, name }` | yes | |

### Phone (`RecordPhone`)

| Field | Type | Notes |
| --- | --- | --- |
| `type` | `mobile` \| `business` \| `home` \| `other` | |
| `number` | string | E.164 on write (e.g. `+19015550100`) |
| `displayNumber` | string | Response-only formatted. Ignore on write |
| `isPrimary` | boolean | One primary per supplier |

### Write shape

```json
{
  "companyName": "PackRight Supplies",
  "contactNames": ["Maria Santos", "Luis Perez"],
  "addresses": ["88 Industrial Pkwy, Elizabeth, NJ"],
  "phones": [
    { "type": "business", "number": "+19015550100", "isPrimary": true }
  ],
  "emails": ["sales@packright.com"]
}
```

### Read shape

```json
{
  "id": "674a1b2c3d4e5f6789012346",
  "companyName": "PackRight Supplies",
  "contactNames": ["Maria Santos", "Luis Perez"],
  "addresses": ["88 Industrial Pkwy, Elizabeth, NJ"],
  "phones": [
    {
      "type": "business",
      "number": "+19015550100",
      "displayNumber": "(901) 555-0100",
      "isPrimary": true
    }
  ],
  "emails": ["sales@packright.com"],
  "createdAt": "2026-05-20T14:30:00Z",
  "createdBy": { "id": "42", "name": "Hector Mejia" },
  "updatedAt": "2026-05-20T14:30:00Z",
  "updatedBy": { "id": "42", "name": "Hector Mejia" }
}
```

**Delete:** reject if referenced by any receipt.

---

## Relationships

```txt
inventory_items 1 ── 1 inventory_stock
inventory_items 1 ── * inventory_receipts
inventory_items 1 ── * inventory_dispatches
inventory_suppliers 1 ── * inventory_receipts
```

---

## Endpoints (CRUD + list + search)

All under `/v1`. Same list/search conventions as customers (`page`, `limit`, `offset`, `sort`; `POST …/search`).

| Resource | List | Search | Get | Create | Update | Delete |
| --- | --- | --- | --- | --- | --- | --- |
| Items | `GET /inventory/items` | `POST /inventory/items/search` | `GET /inventory/items/:id` | `POST /inventory/items` | `PUT /inventory/items/:id` | `DELETE /inventory/items/:id` |
| Stock | `GET /inventory/stock` | `POST /inventory/stock/search` | `GET /inventory/stock/:id` | — (created with item) | — (via receipt/dispatch) | — (deleted with item) |
| Receipts | `GET /inventory/receipts` | `POST /inventory/receipts/search` | `GET /inventory/receipts/:id` | `POST /inventory/receipts` | `PUT /inventory/receipts/:id` | `DELETE /inventory/receipts/:id` |
| Dispatches | `GET /inventory/dispatches` | `POST /inventory/dispatches/search` | `GET /inventory/dispatches/:id` | `POST /inventory/dispatches` | `PUT /inventory/dispatches/:id` | `DELETE /inventory/dispatches/:id` |
| Suppliers | `GET /inventory/suppliers` | `POST /inventory/suppliers/search` | `GET /inventory/suppliers/:id` | `POST /inventory/suppliers` | `PUT /inventory/suppliers/:id` | `DELETE /inventory/suppliers/:id` |

`GET /inventory/items` should return catalog **plus** `quantity` and `averageCost` (stock page).

---

## Permissions

Seed **list + view + create + update + delete** for each resource. Portal expands CRUD flags the same way as checks/customers:

```txt
{ resourceType, list, view, create, update, delete }
  → canListX / canViewX / canCreateX / canUpdateX / canDeleteX
```

| resourceType | list | view | create | update | delete |
| --- | --- | --- | --- | --- | --- |
| `inventory_item` | `canListInventoryItem` | `canViewInventoryItem` | `canCreateInventoryItem` | `canUpdateInventoryItem` | `canDeleteInventoryItem` |
| `inventory_stock` | `canListInventoryStock` | `canViewInventoryStock` | `canCreateInventoryStock` | `canUpdateInventoryStock` | `canDeleteInventoryStock` |
| `inventory_receipt` | `canListInventoryReceipt` | `canViewInventoryReceipt` | `canCreateInventoryReceipt` | `canUpdateInventoryReceipt` | `canDeleteInventoryReceipt` |
| `inventory_dispatch` | `canListInventoryDispatch` | `canViewInventoryDispatch` | `canCreateInventoryDispatch` | `canUpdateInventoryDispatch` | `canDeleteInventoryDispatch` |
| `inventory_supplier` | `canListInventorySupplier` | `canViewInventorySupplier` | `canCreateInventorySupplier` | `canUpdateInventorySupplier` | `canDeleteInventorySupplier` |

Seed example:

```json
[
  { "resourceType": "inventory_item", "list": true, "view": true, "create": true, "update": true, "delete": true },
  { "resourceType": "inventory_stock", "list": true, "view": true, "create": true, "update": true, "delete": true },
  { "resourceType": "inventory_receipt", "list": true, "view": true, "create": true, "update": true, "delete": true },
  { "resourceType": "inventory_dispatch", "list": true, "view": true, "create": true, "update": true, "delete": true },
  { "resourceType": "inventory_supplier", "list": true, "view": true, "create": true, "update": true, "delete": true }
]
```

Portal workspace gates:

| Route | Permission |
| --- | --- |
| `/inventory/items` (Stock) | `canListInventoryStock` |
| `/inventory/receipts` | `canListInventoryReceipt` |
| `/inventory/dispatches` | `canListInventoryDispatch` |
| `/inventory/suppliers` | `canListInventorySupplier` |

Item add/edit/delete on the Stock page uses `inventory_item` create/update/delete.

Until these are seeded, the portal still accepts the legacy `delivery:canViewDelivery` / `inventory:canViewInventory` grants.
