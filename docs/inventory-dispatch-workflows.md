# Inventory workflows: receipts, dispatch handoff and reconciliation

Proposed API contract for confirmed inventory movements. It supersedes the
earlier reconciliation-only proposal (`pending-inventory-dispatches.md`). The
portal on `feat/inventory-confirmations-reconciliation` already calls every
endpoint below; deploy it together with the API. Until the API ships, the new
actions return the API error and nothing changes in stock.

Inventory here is the company's **internal supplies** (boxes, tape, etc.), not
customer merchandise. See `APP_CONTEXT.md` → Inventory.

## What changes

| Requirement | Before | After |
| --- | --- | --- |
| Assign supplies to an employee, vehicle or route crew, with an optional daily route | Dispatch draft, then **Post** moves stock immediately | Unchanged draft; **Post** now submits the dispatch for handoff confirmation |
| Warehouse and employee/route confirm the handoff | Not supported | Both parties confirm; stock moves when the second one confirms |
| Stock shows warehouse and pending amounts | One company-wide **Available** total | Adds **In warehouse** and **Pending** (in custody, not yet reconciled) per item |
| Reconcile sold / returned / lost / missing / damaged (and stolen) | One-step reconcile, single revenue figure | Submitted reconciliation with a required description for losses |
| Payments per method (cash, Zelle, check, deposit, card) with their fields | Not supported | Payment lines posted as income to the employee or route supervisor; any unpaid remainder is a credit sale collected later |
| Warehouse and employee confirm the reconciliation | Not supported | Both parties confirm; effects apply when the second one confirms |
| Receipt: supplier, item, quantity, unit price | Supported | Unchanged |
| Warehouse confirms the receipt | Posting was the only step | **Post** submits; the warehouse confirms and stock increases |

## Shared concepts

### Parties

Every confirmation is made by one **party**:

| Party | Meaning | Permission |
| --- | --- | --- |
| `WAREHOUSE` | Warehouse staff releasing or receiving the physical supplies | `canConfirmInventoryWarehouse` |
| `CUSTODIAN` | The employee, vehicle crew or daily route that takes custody of the supplies | `canConfirmInventoryCustodian` |

Both permissions live on resource type `inventory_confirmation`. They must be
seeded explicitly. Legacy `delivery:canViewDelivery` / `inventory:canViewInventory`
grants must **not** imply them, and neither does `canReconcileInventoryDispatch`.

Custodian eligibility is decided by the API. A user can confirm as `CUSTODIAN`
only when their linked employee is one of:

- the dispatch's responsible employee (`assigneeEmployeeId`),
- the employee holder (holder type `EMPLOYEE`),
- a member of the route-crew holder (holder type `ROUTE_CREW`),
- the supervisor of the dispatch's daily route.

Otherwise the API returns `NOT_RESPONSIBLE_PARTY`.

Custodians always confirm with their own portal account. There is **no**
"confirm on behalf of" option.

**Segregation of duties:** on dispatches and reconciliations the same user
cannot confirm both parties (`SAME_ACTOR`). Receipts have a single party.

### Confirmation object

```json
{
  "confirmedAt": "2026-10-28T13:05:00Z",
  "confirmedBy": { "id": 7, "name": "Luis Warehouse" },
  "notes": "Counted 40 boxes"
}
```

Documents and reconciliations carry the following server-owned fields:

```json
{
  "confirmations": { "warehouse": { "...": "..." }, "custodian": null },
  "rejection": {
    "rejectedAt": "2026-10-28T13:10:00Z",
    "rejectedBy": { "id": 12, "name": "Ana Pérez" },
    "party": "CUSTODIAN",
    "reason": "Only 35 boxes were loaded"
  },
  "allowedActions": ["CONFIRM_WAREHOUSE", "REJECT"]
}
```

- `rejection` is the most recent rejection (or `null`). It stays visible on the
  returned draft so the author knows what to fix.
- `allowedActions` is computed **for the calling user**. It covers permission,
  custodian eligibility, segregation of duties and the parties that are still
  missing. The portal shows an action only when the user has the permission
  **and** the action is listed. Values: `CONFIRM_WAREHOUSE`, `CONFIRM_CUSTODIAN`,
  `REJECT`.

### Document status

`InventoryDocumentStatus` gains `PENDING_CONFIRMATION`:

```txt
DRAFT ──post──▶ PENDING_CONFIRMATION ──all parties confirm──▶ POSTED
  ▲                    │
  └──────reject────────┘          DRAFT ──cancel──▶ CANCELLED
```

- `PENDING_CONFIRMATION` documents are read-only (PATCH returns `INVALID_STATE`)
  and cannot be cancelled. Reject them back to `DRAFT` first.
- `postedAt` / `postedBy` are set when the ledger effect happens (the final
  confirmation). New `submittedAt` / `submittedBy` record the **Post** click.
- Every command uses `If-Match: <version>`. Confirm also uses
  `Idempotency-Key`, so replaying the same key and payload returns the original
  result.

### Stock buckets

The portal derives the buckets from `/inventory/stock` balances and holder types
(no new endpoint):

| Bucket | Computed as |
| --- | --- |
| **In warehouse** | `AVAILABLE` `quantityOnHand` on `WAREHOUSE` holders |
| **Reserved** | `quantityReserved` on warehouse balances (dispatches awaiting handoff) |
| **Pending** | `AVAILABLE` `quantityOnHand` on `EMPLOYEE`, `VEHICLE` and `ROUTE_CREW` holders, meaning dispatched but not reconciled yet |
| **Quarantined** | `QUARANTINED` `quantityOnHand` on any holder |
| **Available** (existing) | All `AVAILABLE` on hand, which is In warehouse + Pending |

The API must keep `quantityReserved` accurate for dispatches in
`PENDING_CONFIRMATION` (see the dispatch workflow).

## 1. Receipt workflow

1. Office creates a receipt draft: supplier, receiving warehouse, received at,
   and lines of item, quantity and unit cost. *(unchanged)*
2. Office clicks **Post**. The receipt moves to `PENDING_CONFIRMATION`, and stock
   does not change.
3. Warehouse counts the goods and then either:
   - **confirms**, which posts the receipt: stock and valuation increase
     atomically and the status becomes `POSTED`; or
   - **rejects** with a reason (for example a short delivery). The receipt goes
     back to `DRAFT`, and the office corrects the lines and posts again.

Receipts created by Daily Income **Register inventory change → received** follow
the same rule. The expense journal posts immediately, but stock increases only
when the warehouse confirms.

### API

`POST /v1/inventory/receipts/{id}/post`: same headers as today. It now results in
`PENDING_CONFIRMATION` and sets `submittedAt` / `submittedBy`.

`POST /v1/inventory/receipts/{id}/confirm`
Permission `canConfirmInventoryWarehouse`. Headers `If-Match`, `Idempotency-Key`.

```json
{ "party": "WAREHOUSE", "notes": "All boxes counted" }
```

`POST /v1/inventory/receipts/{id}/reject`
Permission `canConfirmInventoryWarehouse`. Header `If-Match`.

```json
{ "party": "WAREHOUSE", "reason": "Supplier delivered 30, not 40" }
```

Receipt responses add `submittedAt`, `submittedBy`, `confirmations`
(`custodian` is always `null`), `rejection` and `allowedActions`.

## 2. Dispatch (handoff) workflow

1. Office or the dispatcher creates a dispatch draft: source warehouse,
   destination holder (employee, vehicle or route crew), optional responsible
   employee, optional daily route, and lines. *(unchanged)*
2. **Post** moves the dispatch to `PENDING_CONFIRMATION`. The API checks source
   availability and **reserves** the quantities in the warehouse
   (`quantityReserved`), so the same supplies cannot be dispatched twice.
3. The warehouse confirms the release and the custodian confirms receipt, in
   either order.
4. When the second party confirms, the dispatch becomes `POSTED`. In one
   transaction the reservation is released and stock moves from the warehouse to
   the holder. Warehouse stock goes down and Pending goes up.
5. Either party can **reject** with a reason (for example "only 35 loaded").
   This clears both confirmations, releases the reservation and returns the
   dispatch to `DRAFT`.

Dispatches created by Daily Income **Register inventory change → dispatched**
follow the same handoff rule.

### API

`POST /v1/inventory/dispatches/{id}/post`: same headers as today. It reserves the
quantities and results in `PENDING_CONFIRMATION`. Error: `INSUFFICIENT_STOCK`.

`POST /v1/inventory/dispatches/{id}/confirm`
Permission: `canConfirmInventoryWarehouse` for `WAREHOUSE`, or
`canConfirmInventoryCustodian` for `CUSTODIAN`. Headers `If-Match`,
`Idempotency-Key`.

```json
{ "party": "CUSTODIAN", "notes": "Loaded on Truck 3" }
```

Errors: `ALREADY_CONFIRMED`, `SAME_ACTOR`, `NOT_RESPONSIBLE_PARTY`,
`INSUFFICIENT_STOCK` (re-checked on the final confirmation).

`POST /v1/inventory/dispatches/{id}/reject`
Same permission as confirm for the given party. Header `If-Match`.

```json
{ "party": "WAREHOUSE", "reason": "Truck left before loading finished" }
```

Dispatch responses add `submittedAt`, `submittedBy`, `confirmations`,
`rejection` and `allowedActions`.

## 3. Reconciliation workflow

A `POSTED` dispatch keeps its supplies **pending** (in the holder's custody)
until each unit is accounted for. A reconciliation is a **submitted claim**. It
does nothing to stock or income until both parties confirm it.

1. Someone with `canReconcileInventoryDispatch` opens the dispatch in **Pending
   Transactions → Inventory** and enters, per item:
   - **Sold** (with sale revenue),
   - **Returned** (back to the source warehouse),
   - **Damaged** (quarantine or write off),
   - **Lost**, **Missing**, **Stolen**.
2. They enter **payments** for the sold supplies. There is one line per payment
   method, and each method has its own fields:

   | Method | Fields |
   | --- | --- |
   | Cash | amount |
   | Check | amount, bank account, **check number** (string, keeps leading zeros) |
   | Zelle | amount, bank account, reference / confirmation # (optional) |
   | Deposit | amount, bank account, reference (optional) |
   | Credit card | amount, bank account, reference / authorization (optional) |

   The payment total can be **less** than the sale revenue but never more. The
   unpaid remainder (`creditMinor`) is a **credit sale**: the supplies were sold
   but the money will be collected later. Payments can also be empty, meaning
   the whole sale is on credit.
3. They choose who receives the **income**: the responsible employee or the
   daily-route supervisor. The API offers the eligible people in
   `incomeRecipients`. That person is also responsible for collecting any credit.
4. **Description** (`notes`) explains the reconciliation. It is **required**
   when anything is damaged, lost, missing or stolen, or when part of the sale is
   on credit (who owes it and when it will be collected).
5. Submitting creates the reconciliation as `PENDING_CONFIRMATION`. Its
   quantities move from *outstanding* to *awaiting confirmation*, so they cannot
   be reconciled twice.
6. The warehouse confirms what came back (returned and damaged units, and the
   cash handed in). The custodian confirms the sold, lost, missing and stolen
   counts. Submitting does **not** auto-confirm either side.
7. When the second party confirms, the reconciliation becomes `CONFIRMED`, and
   in one transaction:
   - `RETURNED` goes back to the source warehouse as `AVAILABLE`;
   - `DAMAGED` becomes a DAMAGED disposition (`QUARANTINE` moves stock to the
     warehouse as `QUARANTINED`; `WRITE_OFF` removes it);
   - `LOST` / `MISSING` / `STOLEN` become dispositions of that type (write-off);
   - `SOLD` becomes a supply sale for the holder with the actual revenue,
     decrementing holder stock once;
   - each payment line becomes an **income journal** (see below);
   - any credit remainder becomes a **collection obligation** (see below);
   - the confirmed quantities count toward `reconciledQuantity`.
8. Either party can **reject** with a reason. The reconciliation becomes
   `REJECTED` (immutable), its quantities return to outstanding, and a corrected
   reconciliation can be submitted.

Units nobody reconciles stay pending with the holder. Retained custody overnight
is not an outcome. A dispatch leaves the pending list when every line has
`outstandingQuantity = 0` **and** nothing is awaiting confirmation.

### Income journals

On confirmation the API posts one journal per payment line:

- `transactionType: "SALES"`, `amount` = `amountMinor / 100`;
- `employee` = the chosen income recipient (financial accountability);
- `dailyRoute` attribution from the dispatch when present;
- `paymentMethod`, `paymentAccount`, `paymentReference` (check number, also
  dual-written to legacy `checkNumber`) and `externalReferenceNumber`;
- references `inventoryDispatchId` and `inventoryReconciliationId`;
- posted into the open income statement (cuadre) for the confirmation business
  date. The branch comes from the daily route; without a route it is the income
  recipient's branch (decided).

Cash lines then follow the normal employee cash-handover flow. Check, Zelle,
deposit and card lines create the usual outstanding clearing records, so they
appear in the clearing directories and the Financial tab of Pending
Transactions.

### Credit sales

When `creditMinor > 0`, the final confirmation also creates an `OPEN` collection
obligation (the existing Supply operations resource
`/inventory/collection-obligations`):

- `amountMinor` = `creditMinor`; `responsibleEmployeeId` = the income recipient;
- `description` = the reconciliation `notes`;
- references `inventoryDispatchId` and `inventoryReconciliationId`.

No income journal is posted for the credit part at confirmation. When the money
comes in, it is recorded as a payment and applied through the obligation's
existing **settlements** (`PARTIALLY_SETTLED` → `SETTLED`), which posts the
income at that time. The reconciliation response returns `creditMinor` and
`collectionObligationId`, and the history shows "On credit $X".

**No double counting:** dispatches created by Daily Income *Register inventory
change → dispatched* already posted their sales at dispatch time. The API marks
them `salesRecordedAtDispatch: true`. Their reconciliations must not include
`revenueMinor` or `payments` (`SALES_ALREADY_RECORDED`). The portal hides those
fields for such dispatches.

### List: `POST /v1/inventory/pending-dispatches/search`

Permission `canListInventoryDispatch`. Company-scoped by `x-company-id`. Returns
`POSTED` dispatches with `outstandingQuantity > 0` **or**
`awaitingConfirmationQuantity > 0`. The request is unchanged:

```json
{
  "filters": [
    { "field": "holder.id", "operator": "eq", "value": "truck_3" },
    { "field": "dispatchedAt", "operator": "gte", "value": "2026-10-01T00:00:00Z" },
    { "field": "dispatchedAt", "operator": "lte", "value": "2026-10-28T23:59:59.999Z" },
    { "field": "ageDays", "operator": "gte", "value": 2 }
  ],
  "pagination": { "page": 1, "limit": 40 },
  "sort": [{ "field": "dispatchedAt", "direction": "asc" }]
}
```

Each row in the response (`{ "success": true, "data": [...], "total": 41 }`):

```json
{
  "id": "<dispatch id>",
  "dispatchedAt": "2026-10-26T13:00:00Z",
  "ageDays": 2,
  "holder": { "id": "truck_3", "type": "VEHICLE", "displayName": "Truck 3" },
  "assigneeEmployee": { "id": "12", "name": "Ana Pérez" },
  "dailyRoute": {
    "id": "<route id>",
    "name": "2026-10-26_Truck_Ana",
    "supervisor": { "id": "15", "name": "Carlos Ruiz" }
  },
  "incomeRecipients": [
    { "id": "15", "name": "Carlos Ruiz", "role": "SUPERVISOR" },
    { "id": "12", "name": "Ana Pérez", "role": "RESPONSIBLE" }
  ],
  "salesRecordedAtDispatch": false,
  "dispatchedQuantity": 40,
  "reconciledQuantity": 5,
  "awaitingConfirmationQuantity": 10,
  "outstandingQuantity": 25,
  "pendingReconciliationCount": 1,
  "lines": [
    {
      "id": "<dispatch line id>",
      "item": { "id": "box", "name": "Small box", "sku": "BX-S", "unitOfMeasure": "unit" },
      "dispatchedQuantity": 30,
      "reconciledQuantity": 5,
      "awaitingConfirmationQuantity": 10,
      "outstandingQuantity": 15
    }
  ]
}
```

- `outstandingQuantity = dispatchedQuantity − reconciledQuantity − awaitingConfirmationQuantity`.
- `reconciledQuantity` counts only **confirmed** reconciliations, plus returns,
  dispositions, sales reports and closeouts that reference the dispatch through
  other documents, so nothing is reconciled twice.
- `incomeRecipients` lists the supervisor first when there is a daily route.
  Roles are `SUPERVISOR`, `RESPONSIBLE` and `HOLDER` (the employee holder).
  Duplicates are merged.
- `holder`, `item`, `assigneeEmployee`, `dailyRoute` and `incomeRecipients` are
  joined server-side, so the portal makes no per-row lookups. `ageDays` is whole
  days since `dispatchedAt` in the company timezone.

### History: `GET /v1/inventory/dispatches/{id}/reconciliations`

Permission `canViewInventoryDispatch`. Newest first:

```json
{
  "success": true,
  "data": [{
    "id": "<reconciliation id>",
    "status": "PENDING_CONFIRMATION",
    "version": 1,
    "recordedAt": "2026-10-27T10:00:00Z",
    "occurredAt": "2026-10-27T09:30:00Z",
    "performedBy": { "id": 3, "name": "Office" },
    "notes": "2 boxes crushed in the truck",
    "incomeEmployee": { "id": "15", "name": "Carlos Ruiz" },
    "lines": [
      { "dispatchLineId": "<line id>", "itemName": "Small box", "outcome": "SOLD", "quantity": 5, "revenueMinor": 6000 },
      { "dispatchLineId": "<line id>", "itemName": "Small box", "outcome": "DAMAGED", "quantity": 2, "damageResolution": "QUARANTINE" }
    ],
    "payments": [
      { "paymentMethod": { "id": 1, "name": "CASH" }, "amountMinor": 4000 },
      {
        "paymentMethod": { "id": 4, "name": "ZELLE" },
        "amountMinor": 2000,
        "paymentAccount": { "id": 21, "name": "Bank of America" },
        "externalReferenceNumber": "ZL-88231"
      }
    ],
    "confirmations": { "warehouse": null, "custodian": null },
    "rejection": null,
    "allowedActions": ["CONFIRM_WAREHOUSE", "REJECT"]
  }]
}
```

### Submit: `POST /v1/inventory/dispatches/{id}/reconciliations`

Permission `canReconcileInventoryDispatch` (no legacy alias). Header
`Idempotency-Key: <requestId>` (required).

```json
{
  "requestId": "2b1c…",
  "occurredAt": "2026-10-28T13:30:00.000Z",
  "notes": "Route 5 return, 2 boxes crushed",
  "incomeEmployeeId": "15",
  "lines": [
    { "dispatchLineId": "<line id>", "outcome": "SOLD", "quantity": 10, "revenueMinor": 12010 },
    { "dispatchLineId": "<line id>", "outcome": "RETURNED", "quantity": 15 },
    { "dispatchLineId": "<line id>", "outcome": "DAMAGED", "quantity": 2, "damageResolution": "QUARANTINE" }
  ],
  "payments": [
    { "paymentMethod": { "id": 1, "name": "CASH" }, "amountMinor": 8000 },
    { "paymentMethod": { "id": 2, "name": "CHECK" }, "amountMinor": 4010, "paymentAccountId": 21, "paymentReference": "000123", "checkNumber": "000123" }
  ]
}
```

Validation:

- The dispatch must be `POSTED` (`INVALID_STATE`).
- `quantity` is an integer > 0. Per line, the submitted total must not exceed the
  current `outstandingQuantity` (`INSUFFICIENT_OUTSTANDING`).
- `SOLD` requires `revenueMinor` (integer USD cents, ≥ 0) and `DAMAGED` requires
  `damageResolution`. Other outcomes reject both fields.
- `notes` is required (trimmed, ≤ 1000 characters) when any line is `DAMAGED`,
  `LOST`, `MISSING` or `STOLEN`, or when there is a credit remainder
  (`NOTES_REQUIRED`).
- `payments` is only allowed when there is at least one `SOLD` line, and
  `Σ payments.amountMinor` must not exceed `Σ SOLD revenueMinor`
  (`PAYMENT_EXCEEDS_REVENUE`). The API computes
  `creditMinor = Σ SOLD revenueMinor − Σ payments.amountMinor`; the portal does
  not send it.
- Each payment needs an integer `amountMinor` > 0 and a `paymentMethod` from
  `/accounting/paymentmethods`. Non-cash methods require `paymentAccountId`, a
  `BANK` chart account (`PAYMENT_ACCOUNT_REQUIRED`). `CHECK` requires
  `paymentReference` as a string with leading zeros preserved
  (`CHECK_NUMBER_REQUIRED`).
- `incomeEmployeeId` is required when the sale revenue is > 0 (it receives the
  income and owns any credit) or `payments` is non-empty. It must be one of the
  row's `incomeRecipients` (`INVALID_INCOME_EMPLOYEE`).
- `salesRecordedAtDispatch` dispatches reject `revenueMinor` and `payments`
  (`SALES_ALREADY_RECORDED`).
- The same `Idempotency-Key` with the same payload returns the original result;
  a different payload returns `IDEMPOTENCY_CONFLICT`. The portal keeps the key
  across retries of a failed submit and generates a new one only after success.

Response: `201` with the reconciliation (`status: PENDING_CONFIRMATION`). The
portal refetches the list and history either way.

### Confirm: `POST /v1/inventory/dispatches/{id}/reconciliations/{reconciliationId}/confirm`

Permission: `canConfirmInventoryWarehouse` for `WAREHOUSE`, or
`canConfirmInventoryCustodian` for `CUSTODIAN`. Headers `If-Match: <version>`,
`Idempotency-Key`.

```json
{ "party": "WAREHOUSE", "notes": "15 boxes back on the shelf, $80 cash received" }
```

The final confirmation applies every effect in one transaction. It re-checks
`INSUFFICIENT_OUTSTANDING` and the open income statement
(`INCOME_STATEMENT_CLOSED`: the confirmation fails and nothing is applied).
Other errors: `ALREADY_CONFIRMED`, `SAME_ACTOR`, `NOT_RESPONSIBLE_PARTY`,
`INVALID_STATE`.

### Reject: `POST /v1/inventory/dispatches/{id}/reconciliations/{reconciliationId}/reject`

Same permissions as confirm. Header `If-Match`.

```json
{ "party": "CUSTODIAN", "reason": "I sold 8, not 10" }
```

## 4. Auto-reconciliation from Daily Income

Daily Income **Register inventory change → dispatched** records the sale on the
journal itself (quantity × unit price, with the journal's payment method). For
users who can reconcile dispatches, the transaction form offers **Auto-reconcile
(mark as sold)**. It works the same way as **Auto-approve (mark as cleared)** for
invoice payments:

- It is visible only when the user has `canReconcileInventoryDispatch`, the
  direction is `dispatched` and the quantity is > 0.
- It is available on **create only**. Editing a journal never re-runs it.
- The review step shows "Reconciled as sold on save".

When the switch is on, the portal adds `autoReconcile: true` to
`POST /v1/accounting/journal`, next to the existing `autoClear` flag. In the same
transaction as the journal, the API then:

1. creates and posts the dispatch with both handoff confirmations recorded for
   the registering user, so stock moves from the warehouse to the holders;
2. creates a `CONFIRMED` reconciliation that marks the whole quantity `SOLD`,
   with `autoReconciled: true` and no `revenueMinor` / `payments`, because the
   sale and its payment are the journal itself;
3. decrements holder stock once. The dispatch never appears in Pending
   Transactions → Inventory.

Rules:

- The API checks `canReconcileInventoryDispatch` itself and rejects the flag
  without it (`403 AUTO_RECONCILE_FORBIDDEN`). It never silently ignores the
  flag.
- `autoReconcile` on any other transaction type or direction returns
  `INVALID_AUTO_RECONCILE`.
- Auto-reconciliation is a deliberate exception to `SAME_ACTOR`. The audit
  event and the reconciliation record `autoReconciled: true` and the registering
  user as both parties.
- If any step fails (for example `INSUFFICIENT_STOCK`), nothing is saved,
  including the journal.
- Without the flag, the journal keeps the normal flow: the dispatch waits for
  handoff confirmation and is reconciled later with `salesRecordedAtDispatch`.

## Error codes

| Code | When |
| --- | --- |
| `INVALID_STATE` | Wrong status for the command (for example editing a pending document) |
| `INSUFFICIENT_STOCK` | Source warehouse cannot cover a dispatch at post or final confirm |
| `INSUFFICIENT_OUTSTANDING` | Reconciled quantity exceeds what is outstanding |
| `ALREADY_CONFIRMED` | The party already confirmed |
| `SAME_ACTOR` | The same user tried to confirm both parties |
| `NOT_RESPONSIBLE_PARTY` | The user is not an eligible custodian |
| `NOTES_REQUIRED` | Loss outcomes or a credit remainder without a description |
| `PAYMENT_EXCEEDS_REVENUE` | Payment total is more than the sale revenue |
| `PAYMENT_ACCOUNT_REQUIRED` | Non-cash payment without a bank account |
| `CHECK_NUMBER_REQUIRED` | Check payment without a check number |
| `INVALID_INCOME_EMPLOYEE` | Income recipient not offered for the dispatch |
| `SALES_ALREADY_RECORDED` | Revenue or payments on a dispatch whose sales were posted at dispatch |
| `INCOME_STATEMENT_CLOSED` | No open cuadre for the confirmation date |
| `IDEMPOTENCY_CONFLICT` | Same key reused with a different payload |
| `AUTO_RECONCILE_FORBIDDEN` (403) | `autoReconcile` without `canReconcileInventoryDispatch` |
| `INVALID_AUTO_RECONCILE` | `autoReconcile` on anything but dispatched inventory |
| `VERSION_CONFLICT` (412) | `If-Match` does not match the current version |

## Backend / API TODOs

- [ ] Add `PENDING_CONFIRMATION` to the receipt and dispatch status enums. Make
      PATCH and cancel reject it.
- [ ] Add `submittedAt`, `submittedBy`, `confirmations`, `rejection` and
      `allowedActions` to receipt and dispatch responses (list, get and search).
- [ ] Change receipt **post** to submit for confirmation. Add receipt
      `confirm` / `reject` (stock and valuation apply on confirm).
- [ ] Change dispatch **post** to validate and reserve source stock. Add
      dispatch `confirm` / `reject` (move stock on the second confirmation;
      release the reservation on reject).
- [ ] Apply the same rules to receipts and dispatches created by Daily Income
      *Register inventory change* (journals still post immediately).
- [ ] Seed `canConfirmInventoryWarehouse` and `canConfirmInventoryCustodian`
      (`inventory_confirmation`) and `canReconcileInventoryDispatch`, with no
      legacy aliases. Add them to the role editor.
- [ ] Custodian eligibility (linked employee ↔ responsible / holder / crew member
      / route supervisor) and the `SAME_ACTOR` rule. Compute `allowedActions`
      per caller.
- [ ] Pending dispatches search: add `awaitingConfirmationQuantity`,
      `pendingReconciliationCount`, `dailyRoute.supervisor`, `incomeRecipients`
      and `salesRecordedAtDispatch`. Include rows that only have reconciliations
      awaiting confirmation.
- [ ] Reconciliation submit: store as `PENDING_CONFIRMATION`. Accept `payments`,
      `incomeEmployeeId` and required `notes` with the validation above. Keep
      the idempotency rules.
- [ ] Reconciliation `confirm` / `reject` endpoints with `If-Match` on the
      reconciliation `version`. The second confirmation applies stock movements,
      dispositions, the supply sale and the income journals atomically.
- [ ] Income journals per payment line (`SALES`, payment method fields, dispatch
      and reconciliation references), plus the cash-handover and clearing records
      that existing journals create.
- [ ] Credit sales: compute `creditMinor`, create the `OPEN` collection
      obligation on the final confirmation, and return `creditMinor` /
      `collectionObligationId` on reconciliations.
- [ ] Mark Daily Income-created dispatches `salesRecordedAtDispatch` and reject
      revenue and payments on their reconciliations.
- [ ] `autoReconcile` on `POST /v1/accounting/journal` for dispatched inventory:
      permission check, dispatch with both handoffs plus a confirmed
      SOLD reconciliation (`autoReconciled: true`) in the journal's transaction,
      and the new error codes.
- [ ] Audit events for submit, confirm, reject and auto-reconcile (who, party,
      notes, reason).
- [ ] Optional: a pending-confirmation count endpoint for navigation badges.

## Portal changes (implemented)

- `PENDING_CONFIRMATION` status badge and filter option for receipts and
  dispatches. Post dialogs and toasts describe the submit-for-confirmation step.
- Receipt and dispatch view sheets show the warehouse and custodian
  confirmations, the last rejection, and **Confirm as warehouse**, **Confirm as
  employee / route** and **Reject** buttons. Each button needs its permission and
  the matching `allowedActions` entry. Confirm takes optional notes; reject
  requires a reason.
- Stock table adds **In warehouse** and **Pending** columns.
- Pending Transactions → Inventory adds an **Awaiting confirmation** column.
  The reconcile dialog adds payment lines with method-specific fields (the total
  can be less than revenue; the remainder shows as "On credit"), an income
  recipient, and a description required for losses and credit. It shows each
  reconciliation's status, credit amount and confirmations with Confirm and
  Reject buttons.
- Daily Income **Register inventory change → dispatched** has an
  **Auto-reconcile (mark as sold)** switch (create only, gated by
  `canReconcileInventoryDispatch`) that sends `autoReconcile: true`.
- New permissions in `src/lib/auth/permissions.ts`:
  `inventoryConfirmWarehouse` and `inventoryConfirmCustodian`.

## Decisions

1. Custodians always have portal accounts, so there is no confirm-on-behalf.
2. Credit sales are allowed. Payments may be less than revenue, and the
   remainder becomes a collection obligation for the income recipient.
3. Income journals go into the closeout of the daily route's branch. When there
   is no daily route, they go into the closeout of the **income recipient's**
   branch.
