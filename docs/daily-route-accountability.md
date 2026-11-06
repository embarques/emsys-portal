# Daily route attribution and accountability

Portal-side contract for the pending API update. The portal already sends and
reads these fields; deploy it together with the API change.

Live check (November 3, 2026, [backend-api-gaps.md](backend-api-gaps.md)):
route journals return the supervisor in `employee` and the `dailyRoute`
snapshot (vehicle, supervisor, driver, helpers). `inventoryHolders` is
unverified: a dispatched INVENTORY journal without holders is rejected with
`422 INVALID_INVENTORY_REGISTRATION`, but with valid holders it returns `500`.

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

## Ledger joint holders and appointment/invoice snapshots — November 5, 2026

The two older TODOs now have different statuses: the ledger joint-holder
contract remains open; appointment/invoice snapshot fields are **live**.
Checks used company `64d5c0b0d1eab2aaf30b1819` with an Administrador token.

### Inventory ledger joint holders — contract still open

- `GET /inventory/dispatches` returns two records, each with a single
  `toHolderId` (empty in these existing sample records), no `inventoryHolders`
  or holder-member array. The published `inventory.Dispatch` schema and portal
  draft schema still expose `fromHolderId`, `toHolderId` and optional
  `dailyRouteId` / `assigneeEmployeeId`.
- A composite **primitive already exists**: both Swagger and the portal define
  `ROUTE_CREW` as a holder type alongside WAREHOUSE, EMPLOYEE and VEHICLE, with
  one `entityId`. Do not describe all composite holders as absent. However,
  that type alone does not establish arbitrary vehicle-plus-employees joint
  custody, immutable membership, quantity counted once, or reconciliation
  releasing every member of the same assignment.
- This company has only one WAREHOUSE holder and no `/route-crews` records.
  No valid joint-custodian ledger fixture was available. No dispatch was posted
  or stock moved during this audit. The two existing dispatch samples and an
  enum do not prove joint stock/reconciliation behavior.
- Keep the backend decision/contract open: define whether arbitrary joint
  custody uses a shared assignment or a composite holder, how members are
  captured, and how one dispatch/reconciliation affects the shared quantity.
  A verified ledger contract is needed before changing the portal's singular
  destination model. This is separate from journal `inventoryHolders`.

### Appointment and invoice analytics snapshots — fields deployed

- A bounded invoice list (40 rows) returned **10** rows with top-level
  `dailyRouteId` and full `dailyRoute`. Detail GET for invoice
  `6aeb6ab8b14be9cb043287d1` returned the same snapshot shape:
  `{ id, name, date, branch, vehicle, supervisor, driver, helpers }`.
  `POST /invoices/search` with `dailyRoute.id eq
  6adcc093f212df43313c64ec` returned `200` and **9** matching invoices.
- Existing routed appointment **21822** returns only `route { id, name }`,
  without `dailyRoute`, on list/detail. A valid appointment search on that
  route's `dailyRoute.id` initially returned `200`, total 0. Historical coverage
  is therefore not complete for the sampled route; do not mark backfill done.
- A new isolated appointment **21828**, assigned through the documented
  `PUT /pickups/route/6ad82cac5d2f9bdb06661d83` with
  `{ "pickupIds": [21828] }`, returned the full snapshot in assignment output,
  GET detail, and search by appointment ID. Both top-level `dailyRoute` and
  nested `route.dailyRoute` contain id/name/date/branch/vehicle/supervisor/
  driver/helpers. Plain appointment POST with a `route` reference did not
  establish assignment; the dedicated assignment operation was required.
- Both appointment and invoice `dailyRoute.id` search filters are accepted.
  Initial appointment probes omitted the required top-level `operator: "and"`
  and returned validation `400`; those malformed requests are not evidence of
  a missing analytics filter. Other snapshot dimensions were not probed.
- The portal's current appointment/invoice normalizers do not retain the full
  new `dailyRoute` analytics object for display. The API-field addition is no
  longer the blocker for showing those fields; UI/model work remains separate.
- Swagger's `pickup.Pickup` / `invoice.Invoice` definitions still omit the new
  top-level snapshots. Historical backfill and snapshot stability after route
  or crew edits remain **unverified**; no existing route/crew was edited.

Cleanup: appointment **21827** (initial create-only probe) and **21828** were
deleted and subsequent GETs returned `404`. Appointment 21828 was unassigned
before deletion. Their synthetic sender/comment tags are
`ZZ_ROUTE_SNAPSHOT_PROBE_20261105_1793900444126` and
`ZZ_ROUTE_SNAPSHOT_PROBE_20261105_1793900487644`. Consumed IDs, ordinary audit
history and any retained inline sender records were not rolled back. No
invoice, existing appointment, route crew or inventory ledger was changed.
