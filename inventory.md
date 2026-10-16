# Inventory System — REST API Contract

Version: 1.0 | Status: Proposed implementation contract | Companion: `models.md`

## 1. Conventions

Base path `/api/v1`. JSON request/response; camelCase; IDs are opaque strings. Dates `YYYY-MM-DD`, timestamps UTC ISO-8601. Monetary amounts integer USD cents with `Minor` suffix. Use `Authorization: Bearer ...`; actor IDs always derived from token. `Idempotency-Key` required for every POST that posts, settles, finalizes, reverses, or reassigns. Optimistic locking via `If-Match` (entity version) on mutable draft updates and closeout reclose. Pagination: `?limit=50&cursor=...`; responses `{data:[...],nextCursor:null}`. Filtering by holder, employee, businessDate, status, item and route as appropriate.

Success: `200` reads/updates, `201` create, `204` delete draft, `409` stale state/conflict, `422` validation, `403` unauthorized, `404` unknown, `400` malformed. Error envelope:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Not enough available stock",
    "details": { "itemId": "item_1", "available": 4, "requested": 6 },
    "correlationId": "req_123"
  }
}
```

A successful posted command returns `{data:{...},postedMovements:[...],version:2}`. Use no generic update/delete of posted documents. All list/detail endpoints apply authorization scope. Currency fixed to USD unless multi-currency explicitly added later.

## 2. Catalog and holder endpoints

| Method    | Path                                | Permission                          | Behavior                                                             |
| --------- | ----------------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| GET/POST  | `/items`                            | `inventory.read` / `catalog.manage` | List/create items.                                                   |
| GET/PATCH | `/items/{id}`                       | `inventory.read` / `catalog.manage` | Detail/update catalog; never set stock quantity.                     |
| GET/POST  | `/items/{id}/prices`                | `inventory.read` / `catalog.manage` | Price history.                                                       |
| GET/POST  | `/suppliers`                        | `inventory.read` / `catalog.manage` | List/create suppliers.                                               |
| GET/PATCH | `/suppliers/{id}`                   | `inventory.read` / `catalog.manage` | Detail/update.                                                       |
| GET       | `/holders`                          | `inventory.read`                    | Filter `type`, `active`.                                             |
| POST      | `/holders`                          | `inventory.holder.manage`           | Create warehouse/employee/vehicle/crew holder reference.             |
| GET       | `/holders/{id}/stock`               | `inventory.read`                    | On-hand, reserved, available, quarantined by item.                   |
| GET       | `/holders/{id}/movements`           | `inventory.read`                    | Append-only movement history.                                        |
| POST      | `/holders/{id}/custody-assignments` | `inventory.reassign`                | Change responsible person; audited.                                  |
| POST      | `/holders/reassign-stock`           | `inventory.reassign`                | Exceptional administrative holder reassignment with ledger transfer. |
| GET/POST  | `/route-crews`                      | `inventory.read` / `routes.manage`  | Persistent crew master.                                              |
| GET/PATCH | `/route-crews/{id}`                 | `inventory.read` / `routes.manage`  | Crew details.                                                        |
| POST      | `/route-crews/{id}/members`         | `routes.manage`                     | Effective-dated membership.                                          |
| GET/POST  | `/daily-routes`                     | `routes.read` / `routes.manage`     | Dated vehicle/employee/role assignment.                              |
| GET/PATCH | `/daily-routes/{id}`                | `routes.read` / `routes.manage`     | Daily route details.                                                 |

Example stock response:

```json
{
  "data": {
    "holderId": "truck_3",
    "items": [
      {
        "itemId": "box_small",
        "available": 7,
        "reserved": 0,
        "quarantined": 2,
        "onHandAvailableCondition": 7
      }
    ]
  }
}
```

## 3. Receipts, dispatches and returns

| Method    | Path                      | Permission                            | Behavior                                            |
| --------- | ------------------------- | ------------------------------------- | --------------------------------------------------- |
| GET/POST  | `/receipts`               | `inventory.read` / `inventory.create` | List/create draft receipts.                         |
| GET/PATCH | `/receipts/{id}`          | `inventory.read` / `inventory.create` | Detail/edit draft only.                             |
| POST      | `/receipts/{id}/post`     | `inventory.post`                      | Atomically increase warehouse stock/valuation.      |
| POST      | `/receipts/{id}/cancel`   | `inventory.create`                    | Cancel draft only.                                  |
| GET/POST  | `/dispatches`             | `inventory.read` / `inventory.create` | Multi-line dispatches.                              |
| GET/PATCH | `/dispatches/{id}`        | `inventory.read` / `inventory.create` | Detail/edit draft only.                             |
| POST      | `/dispatches/{id}/post`   | `inventory.post`                      | Atomically transfer warehouse to persistent holder. |
| POST      | `/dispatches/{id}/cancel` | `inventory.create`                    | Cancel draft only.                                  |
| GET/POST  | `/returns`                | `inventory.read` / `inventory.create` | Return supplies from holder to warehouse.           |
| GET/PATCH | `/returns/{id}`           | `inventory.read` / `inventory.create` | Draft only.                                         |
| POST      | `/returns/{id}/post`      | `inventory.post`                      | Atomically transfer returned quantity.              |

Create dispatch:

```http
POST /api/v1/dispatches
Content-Type: application/json

{"fromHolderId":"warehouse_1","toHolderId":"truck_3","dailyRouteId":"route_day_15","dispatchedAt":"2026-10-15T13:00:00Z","lines":[{"itemId":"box_small","quantity":30},{"itemId":"barrel","quantity":10}]}
```

Response `201`:

```json
{
  "data": {
    "id": "dispatch_123",
    "status": "DRAFT",
    "version": 1,
    "fromHolderId": "warehouse_1",
    "toHolderId": "truck_3",
    "lines": [
      { "id": "dl_1", "itemId": "box_small", "quantity": 30 },
      { "id": "dl_2", "itemId": "barrel", "quantity": 10 }
    ]
  }
}
```

`POST /dispatches/dispatch_123/post` with `Idempotency-Key: ...` checks available stock for every line, locks all affected balances in deterministic order, writes transfer movements and updates balances atomically. `dailyRouteId` is context only, never destination.

## 4. Dispositions, stock counts and adjustments

| Method    | Path                        | Permission                            | Behavior                                                                                             |
| --------- | --------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| GET/POST  | `/dispositions`             | `inventory.read` / `inventory.adjust` | Create categorized disposition (LOST, MISSING, STOLEN, DAMAGED); SOLD is generated by sales posting. |
| GET/PATCH | `/dispositions/{id}`        | `inventory.read` / `inventory.adjust` | Draft only.                                                                                          |
| POST      | `/dispositions/{id}/post`   | `inventory.adjust`                    | Write-off or quarantine transaction.                                                                 |
| GET/POST  | `/stock-counts`             | `inventory.read` / `inventory.count`  | Create physical count.                                                                               |
| GET/PATCH | `/stock-counts/{id}`        | `inventory.read` / `inventory.count`  | Draft count entry.                                                                                   |
| POST      | `/stock-counts/{id}/submit` | `inventory.count`                     | Freeze count snapshot and calculate variances; no silent stock update.                               |
| GET/POST  | `/adjustments`              | `inventory.read` / `inventory.adjust` | Create adjustment to resolve authorized differences.                                                 |
| POST      | `/adjustments/{id}/post`    | `inventory.adjust`                    | Post ledger adjustment.                                                                              |

Example disposition:

```json
{
  "holderId": "truck_3",
  "closeoutId": "closeout_15",
  "type": "DAMAGED",
  "occurredAt": "2026-10-15T21:00:00Z",
  "description": "Boxes crushed during loading",
  "lines": [
    {
      "itemId": "box_small",
      "quantity": 2,
      "damageResolution": "QUARANTINE",
      "description": "Torn corners"
    }
  ]
}
```

## 5. Aggregate sales and payments

| Method    | Path                                       | Permission                            | Behavior                                                                              |
| --------- | ------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------- |
| GET/POST  | `/supply-sales-reports`                    | `sales.read` / `sales.record`         | Create aggregate report for holder/date/closeout.                                     |
| GET/PATCH | `/supply-sales-reports/{id}`               | `sales.read` / `sales.record`         | Draft only.                                                                           |
| POST      | `/supply-sales-reports/{id}/post`          | `sales.post`                          | Single stock deduction plus financial source; never separately post SOLD disposition. |
| GET/POST  | `/payments`                                | `payments.read` / `payments.record`   | Individual payments with method and reference.                                        |
| GET       | `/payments/{id}`                           | `payments.read`                       | Detail.                                                                               |
| POST      | `/payments/{id}/verify`                    | `payments.verify`                     | Manual verification of electronic/check payment.                                      |
| POST      | `/payments/{id}/void`                      | `payments.manage`                     | Audited void; handle allocated amounts first.                                         |
| POST      | `/payment-allocations`                     | `payments.allocate`                   | Allocate payment to supply obligation.                                                |
| GET/POST  | `/cash-handovers`                          | `payments.read` / `payments.handover` | Money/check custody transfer to office.                                               |
| POST      | `/cash-handovers/{id}/receive`             | `payments.handover.receive`           | Receiver acknowledges physical handover.                                              |
| GET       | `/collection-obligations`                  | `collections.read`                    | Filter employee, status, age.                                                         |
| GET       | `/collection-obligations/{id}`             | `collections.read`                    | Outstanding details and settlements.                                                  |
| POST      | `/collection-obligations/{id}/settlements` | `collections.settle`                  | Apply verified payment/handover without double counting.                              |

Sales report supports either pricing mode:

```json
{
  "holderId": "truck_3",
  "closeoutId": "closeout_15",
  "businessDate": "2026-10-15",
  "lines": [
    {
      "itemId": "box_small",
      "quantitySold": 10,
      "pricingMode": "PRICE_GROUPS",
      "priceBreakdowns": [
        { "quantity": 7, "unitPriceMinor": 6000 },
        { "quantity": 3, "unitPriceMinor": 5000 }
      ],
      "totalRevenueMinor": 57000
    },
    {
      "itemId": "barrel",
      "quantitySold": 2,
      "pricingMode": "TOTAL_PER_ITEM",
      "totalRevenueMinor": 14000
    }
  ]
}
```

Payment example:

```json
{
  "method": "ZELLE",
  "amountMinor": 12000,
  "currency": "USD",
  "reference": "ZELLE-ABC",
  "collectedByEmployeeId": "emp_1",
  "collectedAt": "2026-10-15T20:00:00Z"
}
```

## 6. Daily closeout endpoints

| Method   | Path                                   | Permission                          | Behavior                                                                                                 |
| -------- | -------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| GET/POST | `/closeouts`                           | `closeout.read` / `closeout.record` | List/create one holder/date closeout.                                                                    |
| GET      | `/closeouts/{id}`                      | `closeout.read`                     | Detail, current revision, inventory and financial summaries.                                             |
| GET      | `/closeouts/{id}/preview`              | `closeout.read`                     | Server-derived balances, sales, payments, physical count and outstanding differences.                    |
| PATCH    | `/closeouts/{id}`                      | `closeout.record`                   | Edit OPEN/REOPENED closeout notes and count inputs.                                                      |
| POST     | `/closeouts/{id}/close`                | `closeout.finalize`                 | Validate count coverage, classified variance, ledger postings, financial explanation; snapshot revision. |
| POST     | `/closeouts/{id}/reopen`               | `closeout.reopen`                   | Manager/admin only; reason required.                                                                     |
| GET      | `/closeouts/{id}/revisions`            | `closeout.read`                     | Immutable snapshots, correction IDs and audit.                                                           |
| GET      | `/closeouts/{id}/revisions/{revision}` | `closeout.read`                     | Historical version.                                                                                      |

Close request:

```json
{
  "countedItems": [
    { "itemId": "box_small", "available": 7, "quarantined": 2 },
    { "itemId": "barrel", "available": 8, "quarantined": 0 }
  ],
  "financialDifferenceReason": "$50 approved unpaid sale remains to collect",
  "notes": "Driver retains supplies in truck"
}
```

Closing does not itself subtract sales again. All return, sales and disposition documents must be posted or atomically posted as explicitly referenced commands before closeout validation. Response contains derived inventory reconciliation, revenue, collections, obligations, financial difference, revision and status. Reopen request: `{"reason":"Correct count after recount"}`; reclose may post compensating adjustments, references those IDs and creates next immutable revision. Closeout financial discrepancy can remain if documented; unclassified physical variance cannot.

## 7. Reports and audit

`GET /reports/stock?holderId=...`, `/reports/stock-valuation`, `/reports/dispatches`, `/reports/closeouts`, `/reports/employee-obligations`, `/reports/supply-revenue`, `/reports/discrepancies`; `GET /audit-events?entityType=...&entityId=...`; `GET /journal-entries?sourceType=...&sourceId=...`. Read permissions and scope enforced.

## 8. Permissions and consistency

Permissions: `inventory.read`, `inventory.create`, `inventory.post`, `inventory.count`, `inventory.adjust`, `inventory.reassign`, `inventory.holder.manage`, `catalog.manage`, `routes.read`, `routes.manage`, `sales.read`, `sales.record`, `sales.post`, `payments.read`, `payments.record`, `payments.verify`, `payments.manage`, `payments.allocate`, `payments.handover`, `payments.handover.receive`, `collections.read`, `collections.settle`, `closeout.read`, `closeout.record`, `closeout.finalize`, `closeout.reopen`, `reports.read`, `audit.read`. Drivers and office may finalize if granted; only manager/admin roles may receive `closeout.reopen`.

State transition errors use `INVALID_STATE`; insufficient stock `INSUFFICIENT_STOCK`; stale version `VERSION_CONFLICT`; missing count `COUNT_REQUIRED`; physical variance `UNCLASSIFIED_VARIANCE`; unexplained financial difference `FINANCIAL_REASON_REQUIRED`; duplicate closeout `DUPLICATE_CLOSEOUT`; unauthorized holder `HOLDER_SCOPE_DENIED`; duplicate idempotency key with mismatched payload `IDEMPOTENCY_CONFLICT`.

# Inventory System — Frontend Product and UX Specification

Version: 1.0 | Audience: Web/iOS frontend teams | Companions: `models.md`, `endpoints.md`

## 1. Goals and user roles

Build a fast, accurate, mobile-friendly workflow for warehouse personnel, drivers, office staff, managers and administrators. Driver/office users with `closeout.finalize` can close their own authorized closeouts; only managers/admins with `closeout.reopen` can reopen. Never assume role implies permission: render based on server-returned capability set and enforce backend authority. The UI must distinguish inventory holder (warehouse, employee, vehicle, persistent route crew) from daily route (dated employees, vehicle, roles).

## 2. Information architecture / navigation

- Dashboard: warehouse stock, low stock, today's dispatches, open closeouts, unverified payments, outstanding obligations and discrepancies.
- Catalog: items, default prices, effective price history, suppliers.
- Inventory: balances by holder/condition, movement timeline, physical counts, adjustments, damaged quarantine.
- Operations: receipts, dispatches, returns, disposition transactions.
- Routes & holders: persistent route crews, memberships, employees, vehicles, daily routes, custody history.
- Sales & collections: daily aggregate supply sales, payments, handovers, employee obligations.
- Closeouts: open/closed/reopened list, reconciliation editor, revision history.
- Reports & audit: movement exports, valuation, sales, shortages, collections and actions.

## 3. Shared UI rules

Show amounts as USD with 2 decimals; send integer minor units. Quantities are integers >= 0. Use local business date, display local timestamps with timezone. Show clear statuses `DRAFT`, `POSTED`, `OPEN`, `CLOSED`, `REOPENED`, `RECORDED`, `VERIFIED`. Never optimistically claim a posting, closeout or verification succeeded; await server confirmation. Use request idempotency keys for submit/post/close actions; disable repeat while pending, allow safe retry after network failure. Use field-level and top-level validation errors from API. Do not derive authoritative balances client-side: preview endpoint is source of truth.

## 4. Dispatch creation screen

Fields: source warehouse holder, destination holder selector (employee/vehicle/route crew only), optional daily route context, dispatch timestamp, editable multi-item table (item search, current warehouse available stock, quantity, remove line), notes. Provide keyboard-first quick-add and scan-ready item selection. One dispatch can contain many item types; validate nonempty lines and quantities > 0. Review summary before POST. Draft editable; posted read-only with movement IDs, creator/poster and timestamp. No `incomeGained` field and no sale/payment collection on dispatch.

## 5. Receiving and returning

Receipt: supplier, destination warehouse, multiple item lines, quantity, unit purchase cost, total; review/post. Return: origin holder, warehouse destination, multiple items and quantities, condition; partial returns allowed. UI shows available quantity at origin. Employee-to-employee transfer action must not exist: explain return-to-warehouse then redispatch. Admin custody reassignment is a separate permissioned action with reason, source/destination and stock confirmation; show audit trail.

## 6. Daily route and holder management

Route crew editor: persistent crew name, members, roles, effective membership dates. Daily route editor: business date, vehicle, employee members/roles, optional crew association; enforce one route per employee per date. Inventory holder picker displays holder type and stable identity; never show a daily route as a stock holder. Custody assignment history shows who was responsible and when. Overnight stock stays with persistent holder automatically unless office explicitly returns/reassigns it.

## 7. Sales entry (daily totals only)

Daily aggregate sales editor keyed to holder and business date/closeout. Per item show quantity sold, default price (reference only), actual total revenue and price entry mode:

- `TOTAL_PER_ITEM`: quantity and actual total revenue.
- `PRICE_GROUPS`: add quantity + unit price rows; calculated sum must match total quantity and revenue.

Display estimated/actual revenue; don't infer actual revenue solely from default price. Sales posting reduces holder stock exactly once. A SOLD disposition is linked/generated, not separately editable as another decrement. For office-approved unpaid sales, capture responsible employee, amount, approval and optional customer/reference; create collection obligation.

## 8. Payment and handover screens

Allow unlimited payments with method CASH, CHECK, BANK_DEPOSIT, ZELLE, CREDIT_CARD, amount, reference, collectedBy, collectedAt and verification status. A single daily collection may be split across methods. Electronic payment verification is manual office action; show `RECORDED` vs `VERIFIED`. Cash/check handover flow captures giver, receiver, amount, payment links, handover and receipt acknowledgements. Never present money collected by employee as automatically received by office. Payment allocation/settlement screen associates payments or handovers with employee obligations; outstanding carries forward.

## 9. Closeout wizard / workspace

Suggested sections (tabs or steps; save partial progress):

1. **Context**: holder, business date, associated daily route, responsible employee, opening balances.
2. **Activity**: new dispatches, sales, returns, dispositions (sold/lost/missing/stolen/damaged), and adjustment history; links to posted source documents.
3. **Physical count**: count every item and condition with stock; support adding unexpectedly found items. Display `expected`, `counted`, `variance`. Never silently adjust stock. For discrepancy, launch categorized disposition/adjustment form with description and damage resolution; refresh preview after posting.
4. **Retained vs returned**: office chooses which supplies remain with persistent holder or return to warehouse; create explicit return documents. If holder changes administratively, use audited reassignment; no nightly re-dispatch.
5. **Financial**: sales revenue, cash/check/deposit/Zelle/card payments, verified vs unverified, cash handed over vs held, approved unpaid sales, employee obligations, discrepancy and reason.
6. **Review & close**: all counts complete and classified, posted source docs, reconciliation snapshot, financial differences (allow with explanation), close button. Show actor/time and revision.

A physical count is mandatory. Closing is blocked for any unclassified stock difference or missing item count. Financial differences can be closed with an explicit reason and carried-forward obligation. Closing should not re-post sales or returns. On success, show immutable closeout summary, transaction references and export/print action.

### Example closeout summary

| Small boxes                    | Quantity |
| ------------------------------ | -------: |
| Opening                        |       10 |
| Dispatched                     |      +30 |
| Sold                           |      -25 |
| Returned to warehouse          |       -5 |
| Damaged (quarantine)           |       -2 |
| Missing (classified)           |       -1 |
| Expected available remaining   |        7 |
| Physically counted available   |        7 |
| Physically counted quarantined |        2 |

Show quarantined inventory separately from available stock; don't mislabel it as destroyed.

## 10. Reopen and revision UX

Closed closeout is read-only. Manager/admin can select `Reopen`, must enter reason, sees a visible `REOPENED` status and historical revision snapshot. Edits are made in a working revision. On reclose, preview differences and any compensating postings, require confirmation, and show revision history with actor/time/reason and linked correction documents. Ordinary drivers/office users cannot reopen unless they hold the manager/admin permission.

## 11. Validation, errors, accessibility

- Handle insufficient stock, concurrent edit/version conflict, stale preview, unauthorized holder, duplicate closeout, count-required, unclassified variance and payment verification failures with actionable messages.
- Support loading, empty, offline/retry and read-only states; no posting offline. Refresh preview before final close.
- Use accessible labels, clear focus order, screen reader status announcements, keyboard navigation, large touch targets, and error summaries.
- Distinguish `Missing` (unknown whereabouts), `Lost` (confirmed unrecoverable), `Stolen` (theft classification), `Damaged` (quarantine or write-off), and `Sold` (revenue-linked).
- For mobile: sticky totals, collapsible item rows, scan/search, autosave drafts where API supports it, confirmation for irreversible posting.

## 12. Frontend acceptance criteria

1. Create and post a dispatch with at least two items to a vehicle/employee/crew; destination balances update after response.
2. Partial return posts warehouse increase and holder decrease; remaining inventory persists overnight.
3. Closeout supports both revenue entry modes, mixed payment methods, manual verification and cash still held by employee.
4. Mandatory counts include quarantined stock; categorized missing/damage transactions reconcile counts.
5. Authorized user closes with documented financial shortfall; obligation appears next day without duplicate revenue.
6. Manager reopens, corrects and recloses; historical revision is accessible and original posted ledger records remain.
7. UI cannot select daily route as holder, and cannot directly transfer inventory between employees.

# Inventory System — Domain Models and Data Contracts

Version: 1.0 | Status: Proposed implementation contract | Updated: 2026-10-15

## 1. Scope and invariants

A warehouse receives purchased supplies, dispatches multiple items to one persistent accountable holder (employee, vehicle, or route crew), and reconciles daily aggregate sales, returns, retained inventory, losses, and collections. A `DailyRoute` is a dated schedule, **never an inventory holder**. A `RouteCrew` is a persistent entity with effective-dated membership. Each stock balance has exactly one holder. Physical counts are mandatory at closeout. Financial differences may be documented and carried forward; inventory differences must be classified through posted disposition/adjustment transactions before finalization.

No existing data or backwards compatibility is assumed. All records use opaque UUID/ULID identifiers. Monetary values use integer minor units (USD cents), never float. All instants are UTC ISO-8601; `businessDate` is a local calendar date in the configured business timezone (default America/New_York). Quantities are integer units. Use immutable posted source documents and an append-only ledger; reopening a closeout creates a revision and corrective postings, not destructive updates.

## 2. Shared types

```ts
type ID = string;
type MoneyMinor = number; // signed 64-bit integer in persistence; JSON decimal-safe integer
// For amounts potentially exceeding JS safe integers, serialize decimal strings consistently.
type DateOnly = string; // YYYY-MM-DD
type Instant = string; // ISO-8601 UTC
type Currency = "USD";
type DocumentStatus = "DRAFT" | "POSTED" | "CANCELLED";
type CloseoutStatus = "OPEN" | "CLOSED" | "REOPENED";
type HolderType = "WAREHOUSE" | "EMPLOYEE" | "VEHICLE" | "ROUTE_CREW";
type DispositionType = "SOLD" | "LOST" | "MISSING" | "STOLEN" | "DAMAGED";
type DamageResolution = "QUARANTINE" | "WRITE_OFF";
type PaymentMethod =
  | "CASH"
  | "CHECK"
  | "BANK_DEPOSIT"
  | "ZELLE"
  | "CREDIT_CARD";
type PaymentStatus = "RECORDED" | "VERIFIED" | "REJECTED" | "VOIDED";
type ObligationStatus = "OPEN" | "PARTIALLY_SETTLED" | "SETTLED" | "VOIDED";
type Audit = {
  createdAt: Instant;
  createdBy: ID;
  updatedAt: Instant;
  updatedBy: ID;
};
```

All monetary fields below are `MoneyMinor`; `unitCost`/`unitPrice` are minor units per whole item. Every posted source line has a unique ID; all references use IDs, with optional read-only display snapshots.

## 3. Catalog and organizational entities

| Entity              | Required fields                                                                                   | Constraints / meaning                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `Item`              | `id,sku,name,unitOfMeasure,category,defaultSellingPrice,currency,reorderThreshold,isActive,audit` | Unique SKU; no authoritative quantity or averageCost on Item.                                                                        |
| `ItemPrice`         | `id,itemId,price,effectiveFrom,effectiveTo?,audit`                                                | Non-overlapping price intervals per item; sale captures actual price independently.                                                  |
| `Supplier`          | `id,companyName,contacts[],addresses[],isActive,audit`                                            | Supplier master.                                                                                                                     |
| `InventoryHolder`   | `id,type,entityId?,displayName,isActive,audit`                                                    | Stable ID. `entityId` links employee/vehicle/crew; warehouse may link a warehouse master. Unique `(type,entityId)` where applicable. |
| `RouteCrew`         | `id,name,isActive,audit`                                                                          | Persistent group, not a daily route.                                                                                                 |
| `RouteCrewMember`   | `id,crewId,employeeId,role,effectiveFrom,effectiveTo?`                                            | Historical membership; no overlapping duplicate membership.                                                                          |
| `DailyRoute`        | `id,routeTemplateId?,businessDate,vehicleId,members:[{employeeId,role}],crewId?,audit`            | Operational schedule only; employee at most one daily route per business date.                                                       |
| `CustodyAssignment` | `id,holderId,responsibleEmployeeId?,effectiveFrom,effectiveTo?,assignedBy,reason`                 | Responsibility history. Holder stays stable when the responsible person changes.                                                     |

`InventoryHolder` is the single ledger location/accountability key; it can represent a warehouse, employee, vehicle or route crew. Inventory is never automatically shared across members of a crew. The office may reassign responsibility administratively with an audited `CustodyAssignment` change. If the accountable holder ID itself changes, post a `CUSTODY_REASSIGNMENT` ledger transfer (no physical warehouse stop required). Ordinary employee-to-employee supply transfers are prohibited: return to warehouse, then dispatch again. Administrative reassignment is a separately permissioned exception, not a driver transfer.

## 4. Stock and inventory ledger

| Entity               | Fields                                                                                                                                                            | Rules                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `StockBalance`       | `itemId,holderId,condition,quantityOnHand,quantityReserved,version,updatedAt`                                                                                     | Unique `(itemId,holderId,condition)`; `condition=AVAILABLE                                       | QUARANTINED`. Derived projection of ledger; never edited by CRUD. |
| `InventoryMovement`  | `id,itemId,quantity,type,fromHolderId?,toHolderId?,fromCondition?,toCondition?,sourceType,sourceId,sourceLineId,occurredAt,postedAt,postedBy,reversesMovementId?` | Positive quantity; exactly one source; transfer affects both sides atomically; append-only.      |
| `InventoryValuation` | `itemId,valuationPoolId,quantity,totalValueMinor,averageUnitCostMinor,version`                                                                                    | Perpetual weighted average; pool scope fixed by configuration (recommend company-wide per item). |
| `StockCount`         | `id,holderId,businessDate,status,lines:[{id,itemId,condition,expectedQuantity,countedQuantity}],audit`                                                            | Counts are snapshots; must cover every item with an expected balance and any newly found items.  |
| `StockAdjustment`    | `id,holderId,status,reason,description?,lines:[{id,itemId,quantityDelta,condition}],audit`                                                                        | Only posted adjustments change stock; approval rules configurable.                               |

Movement types: `RECEIPT`, `DISPATCH`, `RETURN_TO_WAREHOUSE`, `SALE`, `DISPOSITION`, `CUSTODY_REASSIGNMENT`, `ADJUSTMENT`, `REVERSAL`. Sales and write-offs exit company on-hand; damage quarantine moves from AVAILABLE to QUARANTINED at the same holder (not out of company ownership). The posted source line identity must be unique per posting/revision, with idempotent command processing.

## 5. Operational documents

| Entity                 | Required fields                                                                                               | Posting effect                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Receipt`              | `id,supplierId,toHolderId,receivedAt,status,lines:[ReceiptLine],audit`                                        | Increases warehouse stock and valuation.                                                                               |
| `ReceiptLine`          | `id,itemId,quantity,unitCostMinor`                                                                            | Quantity > 0; supplier purchase cost.                                                                                  |
| `Dispatch`             | `id,fromHolderId,toHolderId,assigneeEmployeeId?,dailyRouteId?,dispatchedAt,status,lines:[DispatchLine],audit` | Transfers warehouse stock to one persistent holder.                                                                    |
| `DispatchLine`         | `id,itemId,quantity`                                                                                          | Quantity > 0, one or more items.                                                                                       |
| `InventoryReturn`      | `id,fromHolderId,toWarehouseHolderId,returnedAt,status,lines:[ReturnLine],audit`                              | Partial/full return; from holder to warehouse only.                                                                    |
| `ReturnLine`           | `id,itemId,quantity,condition`                                                                                | Quantity > 0.                                                                                                          |
| `InventoryDisposition` | `id,holderId,dailyRouteId?,closeoutId?,type,status,description?,occurredAt,lines:[DispositionLine],audit`     | `SOLD` links to sales report and must not double-post. Other categories account for missing/lost/stolen/damaged stock. |
| `DispositionLine`      | `id,itemId,quantity,description?,damageResolution?,salesLineId?`                                              | `DAMAGED` requires resolution. Missing/stolen require description; all types permit description.                       |

`SOLD` is generated/linked from a posted `SupplySalesReport` and must never be independently posted as a second decrement. For `MISSING`, post a documented shortage; later recovery is a new receipt/adjustment referencing the original, not deletion. For `DAMAGED` with `QUARANTINE`, quantity remains owned but unavailable; with `WRITE_OFF`, it exits stock.

## 6. Aggregate sales, payments and accountability

| Entity                 | Fields                                                                                                                     | Rules                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `SupplySalesReport`    | `id,closeoutId,holderId,businessDate,status,lines:[SupplySalesLine],audit`                                                 | Aggregate daily sales, no per-customer sale required. Shipping revenue excluded.                                                   |
| `SupplySalesLine`      | `id,itemId,quantitySold,totalRevenueMinor,pricingMode,priceBreakdowns[]`                                                   | `pricingMode=TOTAL_PER_ITEM                                                                                                        | PRICE_GROUPS`; if groups, sum quantities and amounts must equal line totals. |
| `SalesPriceBreakdown`  | `quantity,unitPriceMinor,totalMinor`                                                                                       | Supports variable prices and discounts reflected in actual unit price.                                                             |
| `Payment`              | `id,method,amountMinor,currency,reference?,collectedByEmployeeId,collectedAt,status,verifiedAt?,verifiedBy?,audit`         | Mixed methods = multiple Payment records. Manual verification for electronic methods; check handling can have verification status. |
| `PaymentAllocation`    | `id,paymentId,targetType,targetId,amountMinor`                                                                             | Target is supply collection obligation; total allocations <= payment amount. No shipping allocations in this module.               |
| `CashHandover`         | `id,fromEmployeeId,toEmployeeId,method,amountMinor,paymentIds[],handedAt,receivedAt?,status,audit`                         | Tracks custody of cash/checks separately from customer payment receipt; never double counts revenue.                               |
| `CollectionObligation` | `id,responsibleEmployeeId,closeoutId?,sourceSalesReportId?,amountMinor,settledMinor,status,description?,approvedBy?,audit` | Unpaid approved supply sales or unremitted employee collections. Employee collection responsibility ≠ automatic personal debt.     |
| `ObligationSettlement` | `id,obligationId,paymentId?,handoverId?,amountMinor,settledAt,recordedBy`                                                  | Outstanding carries forward until settled; no duplicate revenue.                                                                   |

Payment collections and handovers are different events. Money collected but still held by employee is accounted for but not received by office. A payment can be split across obligations using allocations. For occasional approved credit, store approval actor/time and customer reference when known, but responsibility is attributed to employee per business rule.

## 7. Closeout and revisioning

```ts
type DailyCloseout = {
  id: ID;
  holderId: ID;
  accountableEmployeeId?: ID;
  dailyRouteId?: ID;
  businessDate: DateOnly;
  status: CloseoutStatus;
  revision: number;
  inventoryLines: CloseoutInventoryLine[];
  salesReportId?: ID;
  paymentIds: ID[];
  obligationIds: ID[];
  expectedRevenueMinor: MoneyMinor;
  collectionsRecordedMinor: MoneyMinor;
  collectionsRemittedMinor: MoneyMinor;
  outstandingMinor: MoneyMinor;
  financialDifferenceMinor: MoneyMinor;
  financialDifferenceReason?: string;
  closedAt?: Instant;
  closedBy?: ID;
  audit: Audit;
};
type CloseoutInventoryLine = {
  itemId: ID;
  openingQuantity: number;
  receivedQuantity: number;
  soldQuantity: number;
  returnedQuantity: number;
  lostQuantity: number;
  missingQuantity: number;
  stolenQuantity: number;
  damagedQuarantinedQuantity: number;
  damagedWrittenOffQuantity: number;
  otherNetMovementQuantity: number;
  expectedAvailableEnding: number;
  expectedQuarantinedEnding: number;
  countedAvailableEnding: number;
  countedQuarantinedEnding: number;
  description?: string;
};
type CloseoutRevision = {
  id: ID;
  closeoutId: ID;
  revision: number;
  previousRevision?: number;
  reopenedAt?: Instant;
  reopenedBy?: ID;
  reopenReason?: string;
  closedAt: Instant;
  closedBy: ID;
  snapshot: object;
  correctionSourceIds: ID[];
};
```

One closeout per `(holderId,businessDate)` by default; if operations require multiple shifts, introduce an explicit `shiftId` in the unique key rather than overlapping date scopes. A closeout must contain a count for each item and condition remaining with that holder. Formula for available stock: `opening + inbound - sold - returns - lost - missing - stolen - damagedQuarantined - damagedWrittenOff + otherNetMovements = expectedAvailableEnding`; quarantine is tracked separately. Physical counts must match both computed balances after dispositions/adjustments. Unclassified variance blocks closing; categorized inventory losses do not. Financial differences may be closed with required explanation and carry-forward obligation. Closed snapshot is immutable; manager/admin reopening creates a new revision and corrective transactions on reclose.

## 8. Accounting and audit

`JournalEntry(id,sourceType,sourceId,postedAt,lines[])`, `JournalLine(id,accountId,debitMinor,creditMinor)`, `AuditEvent(id,entityType,entityId,action,actorId,at,before?,after?,reason?,correlationId)`. Journal entries balance to zero. Inventory value changes are recognized at weighted-average cost, sales revenue at actual sale amounts, and settlement only when collected/remitted as appropriate. Accounting integration must not post duplicate journal entries for retries.

## 9. Database constraints and indexes

- Unique `Item.sku`; `StockBalance(itemId,holderId,condition)`; `DailyCloseout(holderId,businessDate)`; `CloseoutRevision(closeoutId,revision)`; idempotency key per tenant/operation.
- Foreign keys on all source and target IDs; use restricted deletes for referenced masters.
- Index movements `(holderId,itemId,postedAt)`, closeouts `(businessDate,status)`, obligations `(responsibleEmployeeId,status)`, payments `(collectedByEmployeeId,collectedAt)`.
- Nonnegative posted available stock except an explicit privileged correction process; reserved <= onHand.
- Posted documents and movements immutable; revisions and compensating documents for corrections.
- All authorization enforced server-side; `createdBy`, `postedBy`, `closedBy` derived from auth context.

## 10. Clarifications implemented as explicit policy

- Holder can be employee, vehicle, persistent route crew or warehouse; daily route never owns stock.
- Route crew membership is effective-dated. One accountable holder for each stock balance.
- Driver-to-driver physical transfers require warehouse return then dispatch. Authorized administrative holder reassignment is audited and ledgered without requiring physical movement.
- Office chooses retained holder vs warehouse return during closeout. No automatic nightly inventory reset.
- Sales are daily totals; variable prices; supports total-by-item and price-group input.
- Payment methods cash/check/deposit/Zelle/credit card; mixed tender and manual electronic verification.
- Drivers and office may finalize closeouts if permissioned; manager/admin alone may reopen.
- Financial discrepancies can be documented and closed; inventory variances must be classified by posted transactions.
