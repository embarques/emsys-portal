# Pending Transactions → Inventory: dispatch reconciliation

Proposed API contract for the **Inventory** tab of **Pending Transactions**
(`/accounting/pending-financial-activity`). The portal already calls these
endpoints; deploy it together with the API change. Until then the tab shows the
API error returned by the search request.

## Business rule

A posted inventory ledger dispatch (`/v1/inventory/dispatches`, `status: POSTED`)
moves supplies from a warehouse to one custodian holder (employee, vehicle or
route crew). Those supplies stay **outstanding** until each unit is accounted for
as one of:

| Outcome | Effect the API must apply atomically |
| --- | --- |
| `SOLD` | Supply sale for the holder with the actual `revenueMinor`; reduces holder stock once (linked SOLD disposition, never a second decrement). |
| `RETURNED` | Return from the holder to the dispatch's source warehouse (`fromHolderId`). |
| `DAMAGED` | DAMAGED disposition with `damageResolution` `QUARANTINE` or `WRITE_OFF`. |
| `LOST` / `MISSING` / `STOLEN` | Disposition of that type (write-off). |

`outstandingQuantity = dispatchedQuantity − reconciledQuantity` per line. Stock
the holder simply keeps overnight stays outstanding (retained custody is not an
outcome). A dispatch leaves the pending list when every line reaches 0.

Supplies already reconciled through other documents that reference the dispatch
(returns, dispositions, sales reports, closeouts) must count toward
`reconciledQuantity` so nothing is reconciled twice.

## List: `POST /v1/inventory/pending-dispatches/search`

Permission: `canListInventoryDispatch` (`inventory_dispatch`), company-scoped by
`x-company-id`. Only `POSTED` dispatches with `outstandingQuantity > 0`.

Request (same shape as `/financial-activity/search`):

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

Response `{ "success": true, "data": [...], "total": 41 }`; each row:

```json
{
  "id": "<dispatch id>",
  "dispatchedAt": "2026-10-26T13:00:00Z",
  "ageDays": 2,
  "holder": { "id": "truck_3", "type": "VEHICLE", "displayName": "Truck 3" },
  "assigneeEmployee": { "id": "12", "name": "Ana Pérez" },
  "dailyRoute": { "id": "<route id>", "name": "2026-10-26_Truck_Ana" },
  "dispatchedQuantity": 40,
  "reconciledQuantity": 5,
  "outstandingQuantity": 35,
  "lines": [
    {
      "id": "<dispatch line id>",
      "item": { "id": "box", "name": "Small box", "sku": "BX-S", "unitOfMeasure": "unit" },
      "dispatchedQuantity": 30,
      "reconciledQuantity": 5,
      "outstandingQuantity": 25
    }
  ]
}
```

`holder`, `item` and the optional `assigneeEmployee` / `dailyRoute` are joined
server-side so the portal makes no per-row lookups. `ageDays` is whole days since
`dispatchedAt` in the company timezone.

## History: `GET /v1/inventory/dispatches/{id}/reconciliations`

Permission: `canViewInventoryDispatch`. Newest first:

```json
{
  "success": true,
  "data": [{
    "id": "<reconciliation id>",
    "recordedAt": "2026-10-27T10:00:00Z",
    "occurredAt": "2026-10-27T09:30:00Z",
    "performedBy": { "id": 3, "name": "Office" },
    "notes": "",
    "lines": [{ "dispatchLineId": "<line id>", "itemName": "Small box", "outcome": "SOLD", "quantity": 5, "revenueMinor": 6000 }]
  }]
}
```

## Reconcile: `POST /v1/inventory/dispatches/{id}/reconciliations`

Permission: **new** `canReconcileInventoryDispatch` (`inventory_dispatch`). It
must be seeded explicitly; legacy delivery/inventory view grants must **not**
imply it. Header `Idempotency-Key: <requestId>` (required).

```json
{
  "requestId": "2b1c…",
  "occurredAt": "2026-10-28T13:30:00.000Z",
  "notes": "Route 5 return",
  "lines": [
    { "dispatchLineId": "<line id>", "outcome": "SOLD", "quantity": 10, "revenueMinor": 12010 },
    { "dispatchLineId": "<line id>", "outcome": "RETURNED", "quantity": 15 },
    { "dispatchLineId": "<line id>", "outcome": "DAMAGED", "quantity": 2, "damageResolution": "QUARANTINE" }
  ]
}
```

Validation:

- `quantity` is an integer > 0; per line the submitted total must not exceed the
  current `outstandingQuantity` (`INSUFFICIENT_OUTSTANDING`).
- `SOLD` requires `revenueMinor` (integer USD cents, ≥ 0); `DAMAGED` requires
  `damageResolution`. Other outcomes reject both fields.
- The dispatch must be `POSTED` (`INVALID_STATE`).
- All generated documents and stock movements commit in one transaction.
- Same `Idempotency-Key` + same payload returns the original result; a different
  payload returns `IDEMPOTENCY_CONFLICT`. The portal keeps the key across retries
  of a failed submit and generates a new one only after success.

Response: `201` with the updated pending row (or `204`). The portal refetches the
list and stock afterwards either way.
