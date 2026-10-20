# Inventory — API contract (target)

Single source of truth for the inventory data model shared by EMSYS API and the
portal (`src/lib/inventory/`). Inventory is the company’s **internal supplies**,
not customer merchandise. Company-scoped via `x-company-id`.

Existing inventory records are disposable mock data: **wipe them** when this
contract ships. There is no legacy format to support.

The model follows the published Swagger `inventory.*` definitions (ledger of
holders, stock balances and versioned documents). Sections marked **Decision**
define behavior that Swagger leaves open or that the API currently does
differently; the portal already conforms to every decision unless noted.

---

## Conventions (all inventory resources)

| Topic | Rule |
| --- | --- |
| IDs | UUID v4 strings, server-generated, accepted by every `/{id}` route. References (`itemId`, `supplierId`, `holderId`, …) are stored and returned as the same UUID strings, so `eq` filters match them. |
| Money | Integer minor units (`…Minor`, USD cents). Never floats. |
| Quantities | Integers. Line quantities `> 0`; balances `>= 0`. |
| Dates | RFC 3339 UTC instants (`2026-10-20T14:30:00Z`). Date-only filter values (`2026-10-20`) are accepted and compare against the instant (`gte` = start of day, `lte` = end of day). |
| `version` | Integer, starts at `1`, increments on every write or command. |
| Audit | `audit: { createdAt, createdBy, updatedAt, updatedBy }`, server-set from the session; never accepted in request bodies. `createdBy` / `updatedBy` are `{ id, name }` like other EMSYS resources. |
| Booleans | Always present in responses — never omitted when `false` (`isActive: false` must be serialized). |
| Envelope | Standard success envelope; lists return `data`, `page`, `resultsPerPage`, `total`. Empty lists return `data: []`, not `null`. |

### Decision: writes and concurrency

- **`PATCH` is a JSON merge patch.** Only fields present in the body change;
  omitted fields keep their stored value. `PATCH { "isActive": false }` alone is
  valid. (Today an omitted `isActive` resets to `false`, and `{ isActive }`
  alone is rejected with “required inventory catalog fields missing”.)
- Every `PATCH` and command requires `If-Match: <version>`. A stale version
  returns **409** with the current `version` in the error body.
- Post-type commands also require `Idempotency-Key`; replays return the
  original result.
- The portal sends full payloads plus `isActive` on edits; this stays valid
  under merge semantics.

### Decision: no DELETE

Nothing in inventory is deleted. Catalog records (items, suppliers, holders)
retire with `isActive: false`; documents retire with `cancel` (drafts) or a
correcting document (posted). Inactive records stay readable and filterable.

### Errors

| Status | When |
| --- | --- |
| 400 | Validation (`error` names the field), unknown search field or wrong value type |
| 404 | Unknown id (in the caller’s company) |
| 409 | `If-Match` version conflict; duplicate unique key (`sku`, `companyName`) |
| 422 | Business rule: insufficient stock, posting a non-draft, same source/destination holder |

---

## Catalog

### Item (`inventory.Item`) — `/inventory/items`

| Field | Type | Write | Notes |
| --- | --- | --- | --- |
| `id` | uuid | — | |
| `sku` | string | optional | Unique per company when set (case-insensitive) |
| `name` | string | **required** | Unique per company (case-insensitive) |
| `unitOfMeasure` | string | optional | e.g. `box`, `roll` |
| `category` | string | optional | |
| `defaultSellingPriceMinor` | integer \| null | optional | Cents |
| `currency` | string | optional | `USD` |
| `reorderThreshold` | integer | optional, default `0` | `>= 0`; low-stock flag |
| `isActive` | boolean | optional, default `true` | |
| `version`, `audit` | | — | |

Stock is never stored on the item; read it from `/inventory/stock`.

### Supplier (`inventory.Supplier`) — `/inventory/suppliers`

| Field | Type | Write | Notes |
| --- | --- | --- | --- |
| `companyName` | string | **required** | Unique per company (case-insensitive) |
| `contacts` | `{ name, phone, email }[]` | optional | Blank contacts dropped; `email` validated |
| `addresses` | string[] | optional | Blank entries dropped |
| `isActive` | boolean | optional, default `true` | |

### Holder (`inventory.InventoryHolder`) — `/inventory/holders`

Where stock physically sits.

| Field | Type | Notes |
| --- | --- | --- |
| `type` | `WAREHOUSE \| EMPLOYEE \| VEHICLE \| ROUTE_CREW` | |
| `displayName` | string | Required |
| `entityId` | string | Employee / vehicle / route-crew id; empty for warehouses |
| `isActive` | boolean | |

**Decision:** company onboarding creates one active `WAREHOUSE` holder
(“Main warehouse”). Receipts and dispatches need it; today the tenant has none.

---

## Stock (`inventory.StockBalance`) — `/inventory/stock` (read-only)

One row per `(holderId, itemId, condition)`; `condition` is
`AVAILABLE | QUARANTINED`. Fields: `quantityOnHand`, `quantityReserved`
(integers), `updatedAt`, `version`. Balances change **only** when a document is
posted; clients never write them. The Stock page sums balances per item.

---

## Documents

Shared shape: `status` (`DRAFT | POSTED | CANCELLED`), `lines[]`, `notes`,
`postedAt`, `postedBy`, `postingRevision`, `correctsSourceId`, `version`,
`audit`.

Lifecycle:

```txt
create → DRAFT ──PATCH (If-Match)──▶ DRAFT
DRAFT ──post (If-Match + Idempotency-Key)──▶ POSTED   (writes movements + balances)
DRAFT ──cancel (If-Match)──▶ CANCELLED
POSTED ── immutable; correct with a new document whose correctsSourceId = original id
```

### Receipt (`inventory.Receipt`) — `/inventory/receipts`

Stock **in** from a supplier.

| Field | Type | Write | Rules |
| --- | --- | --- | --- |
| `supplierId` | uuid | **required** | Active supplier |
| `toHolderId` | uuid | **required** | Active `WAREHOUSE` holder |
| `receivedAt` | instant | **required** | |
| `notes` | string | optional | |
| `lines[]` | `{ id?, itemId, quantity, unitCostMinor }` | **required**, ≥ 1 | One line per item; `quantity > 0`; `unitCostMinor >= 0` |

Posting adds `quantity` to `(toHolderId, itemId, AVAILABLE)`.

### Dispatch (`inventory.Dispatch`) — `/inventory/dispatches`

Stock **transfer** between holders (warehouse → custodian). Records no revenue.

| Field | Type | Write | Rules |
| --- | --- | --- | --- |
| `fromHolderId` | uuid | **required** | Active holder |
| `toHolderId` | uuid | **required** | Active holder, ≠ `fromHolderId` |
| `assigneeEmployeeId` | string | optional | |
| `dailyRouteId` | string | optional | Context only |
| `dispatchedAt` | instant | **required** | |
| `notes` | string | optional | |
| `lines[]` | `{ id?, itemId, quantity }` | **required**, ≥ 1 | One line per item; `quantity > 0` |

Posting moves quantities; **422** when `fromHolderId` lacks available stock.

Adjustments, returns, dispositions, counts, sales, payments and closeouts keep
the Swagger shapes and the same conventions (see `docs/inventory-workflow.md`).

---

## Search contract

`POST /inventory/<resource>/search` with the shared DSL (`operator`,
`filters[]` of `{ field, operator, value }`, nested `and`/`or` groups).
Operators: `eq neq contains startsWith gt gte lt lte in notIn`. Values must be
JSON-typed (numbers, booleans, strings). `contains` / `startsWith` are
case-insensitive.

**Decision:** each resource accepts at least these fields, and Swagger lists
them per endpoint. Fields marked † are rejected today and must be added.

| Resource | Searchable fields |
| --- | --- |
| Items | `id`, `sku`, `name`, `category`, `unitOfMeasure`†, `currency`†, `defaultSellingPriceMinor`†, `reorderThreshold`, `isActive`, `audit.createdAt`, `audit.updatedAt` |
| Suppliers | `id`, `companyName`, `contacts.name`†, `contacts.phone`†, `contacts.email`†, `addresses`†, `isActive`, `audit.createdAt` |
| Holders | `id`, `type`, `displayName`, `entityId`, `isActive` |
| Stock | `itemId`, `holderId`, `condition`, `quantityOnHand`, `quantityReserved` |
| Receipts | `id`, `status`, `supplierId`, `toHolderId`, `receivedAt`, `postedAt`, `notes`†, `lines.itemId`†, `audit.createdAt` |
| Dispatches | `id`, `status`, `fromHolderId`, `toHolderId`, `assigneeEmployeeId`, `dailyRouteId`, `dispatchedAt`, `postedAt`, `notes`†, `lines.itemId`†, `audit.createdAt` |

Must hold today but don’t: `isActive eq false` matches inactive records, and
`supplierId eq <uuid>` matches receipts carrying that supplier.

Default sorts: items `name:asc`, suppliers `companyName:asc`, holders
`displayName:asc`, receipts `receivedAt:desc`, dispatches `dispatchedAt:desc`.

---

## Portal alignment

| Contract point | Portal (`src/lib/inventory/api/inventory-api.ts`) |
| --- | --- |
| UUID ids, opaque | Treated as opaque strings; `encodeURIComponent` on paths |
| `If-Match` / `Idempotency-Key` | `inventoryIfMatchHeaders`, `inventoryPostHeaders`; commands blocked without a version |
| Merge PATCH | Sends full payload + current `isActive` (safe under merge) |
| No DELETE | Deactivate (`setInventoryItemsActive` / `setInventorySuppliersActive`), cancel drafts |
| Cents / integers | `defaultSellingPriceMinor`, `unitCostMinor` via exact USD parsing |
| Audit user object | `readApiUserUsername` accepts `{ id, name }` or a string |
| Search | Server pagination + filters (`INVENTORY_*_FILTER_CONFIG`); only fields the API accepts today |

When the † fields ship, the portal adds: item filters for unit / price, supplier
contact and address search, and receipt/dispatch search by note and by item
(`lines.itemId`, resolved from item names like suppliers are today).

Automated checks: `npm run test:api:inventory` (live CRUD through the portal
module), `npm run test:api:filters` (every advanced filter replayed live),
`tests/unit/inventory-api.test.mjs`, `tests/unit/inventory-swagger-contract.test.mjs`.

---

## Permissions

Unchanged resource types; the portal expands CRUD flags to `canListX` /
`canViewX` / `canCreateX` / `canUpdateX` / `canDeleteX`.

| resourceType | Used for |
| --- | --- |
| `inventory_item` | Item create / edit / deactivate (`update`) |
| `inventory_stock` | Stock page list (`canListInventoryStock`), adjustments (`update`) |
| `inventory_receipt` | Receipts list / create / edit; post & cancel use `update` |
| `inventory_dispatch` | Dispatches list / create / edit; post & cancel use `update` |
| `inventory_supplier` | Suppliers list / create / edit / deactivate (`update`) |

`delete` grants stay seeded for compatibility but no inventory route deletes.
Supply-operations capabilities (`inventory.read`, `inventory.post`, …) follow
`docs/inventory-workflow.md`.
