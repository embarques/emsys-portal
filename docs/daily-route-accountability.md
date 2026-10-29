# Daily route attribution and accountability

Portal-side contract for the pending API update. The portal already sends and
reads these fields; deploy it together with the API change.

## Core rule

| Concept | Purpose | Wire fields |
| --- | --- | --- |
| Daily route | Operational attribution and analytics | `vehicleRoute` (`route`, legacy `employeeGroup`) `{ id, name }`; read-only `dailyRoute` snapshot |
| Supervisor | Financial accountability and reconciliation | journal `employee` `{ id, name }` |
| Inventory holders | Joint custody of one inventory assignment | `inventoryHolders { vehicle, employees[] }` |

These stay independent. Referencing a daily route never makes every crew member
or the vehicle responsible for a record.

## Journals (`POST` / `PUT /v1/journals`)

### Income, expense and invoice payments

A journal attributed to a daily route now sends **both** families:

```json
{
  "vehicleRoute": { "id": "<24-char route id>", "name": "2026-10-28_Truck_Ana" },
  "route": { "id": "<same>", "name": "<same>" },
  "employeeGroup": { "id": "<same>", "name": "<same>" },
  "employee": { "id": 12, "name": "Ana" }
}
```

- `employee` is the **responsible supervisor**. The portal pre-selects the
  route's only supervisor and asks the user to choose when the route has several.
- The API must reject a route journal whose `employee` is not a supervisor on
  that daily route at recording time. It must stop clearing `employee` on route
  journals (the previous "one assignee family" rule is retired).
- Journals without a route keep the existing behavior: an explicit `employee`, or
  the creator's linked employee when neither family is sent.
- Invoice payments (`INITIAL-PAYMENT`, `PAYMENT`) on an invoice received by a
  daily route are registered under that route's supervisor, not the whole crew.

### Inventory change (`transactionType: "INVENTORY"`)

Dispatched inventory sends the optional route attribution and the holders. The
legacy single recipient `dispatchedTo` is no longer sent, and `employee` is
`null` (accountability is carried by the holders).

```json
{
  "vehicleRoute": { "id": "<route id>", "name": "…" },
  "employee": null,
  "inventoryQuantity": 20,
  "inventoryHolders": {
    "vehicle": { "id": "veh-1", "name": "Truck" },
    "employees": [{ "id": 12, "name": "Ana" }, { "id": 14, "name": "Ben" }]
  }
}
```

- At least one holder is required: a vehicle, one or more employees, or both.
- The quantity belongs to **one assignment shared by all holders**: 20 boxes for
  a vehicle and two employees is 20 boxes, not 60. Stock must be moved once.
- Reconciliation (sold, returned, transferred, damaged, lost, missing, stolen)
  updates the assignment once and clears it for every holder.
- `vehicleRoute` stays on the record after reconciliation.

## Read model

Journal responses should return:

- `employee` on route journals (the recorded supervisor). The portal keeps this
  value when the journal is edited; it is only replaced when the user picks a
  different route or supervisor.
- `dailyRoute`: a snapshot taken at recording time:
  `{ id, name, date, vehicle { id, name }, supervisor { id, name }, driver { id, name }, helpers [{ id, name }] }`.
  Later edits to the daily route must not change the snapshot or the recorded
  supervisor of existing payments.
- `inventoryHolders` on inventory journals, in the request shape.

## Accounting → Pending Transactions (`POST /v1/financial-activity/search`)

- Pending Transactions is a separate page aggregating Outstanding (not yet
  cleared) journals from all closeouts, with the same filters and multi-select
  as Daily Income; admins reconcile them unless they were auto-approved on
  entry. See
  `docs/pending-transactions-update.md`.
- Reconciliation operates per **supervisor**: route collections carry the
  supervisor in `employee`, so the existing `employee.id` filter, the payment
  method filter and the date range reconcile by supervisor, method and
  collection date.
- Rows should include `dailyRoute { id, name }` (original attribution, unchanged
  by reconciliation). The portal shows it next to the responsible person.

## Not covered yet

- Inventory ledger dispatch documents (`/v1/inventory/dispatches`) still use a
  single `toHolderId`. Joint holders there need a ledger design decision
  (shared assignment vs. a composite holder) before the portal can change.
- Appointments and invoices already keep their daily-route reference
  (`receivedBy` / assignment). The API should add the same snapshot fields for
  analytics; the portal does not display them yet.
