# Supply operations integration

Inventory follows the ledger model in `inventory.md`, now published in the live
Swagger (see [inventory Swagger verification](inventory-swagger-verification.md)).
Two portal surfaces use it:

- **Stock, Receipts, Dispatches, Suppliers** (`/inventory/items`, `/receipts`,
  `/dispatches`, `/suppliers`): directory tables for day-to-day catalog and
  warehouse work. Feature code lives in `src/lib/inventory` and
  `src/components/inventory`.
- **Supply operations** (`/inventory/workflow`): every other part of the lifecycle.
  Feature code lives in `src/lib/inventory/workflow`; the page only composes its
  workspace.

Server data uses company-scoped TanStack Query keys and the central Axios client
for Firebase authorization and company context. Mutations on either surface
invalidate both caches.

## Deployment

Supply operations is behind `NEXT_PUBLIC_INVENTORY_WORKFLOW_ENABLED=true` (build
time; default disabled). The live API now publishes every route the workspace
calls, so enabling it is a rollout decision: grant the named capabilities listed
in the verification doc, then run the end-to-end acceptance cases in
`inventory.md` against a non-production company. The navigation entry requires
`inventory.read`.

The Stock / Receipts / Dispatches / Suppliers screens are not behind the flag.
They already use the new contract, so they require the deployed API.

## Behavior

- Stock lives with a persistent holder (warehouse, employee, vehicle, route crew).
  Holders can be created inline from any holder picker. Daily routes are context
  only.
- Items show available, quarantined and reserved quantities summed from
  `/inventory/stock`; the item view lists stock by holder. Items and suppliers are
  deactivated/reactivated instead of deleted.
- Receipts and dispatches are multi-line drafts. Edits use PATCH + `If-Match`.
  Posting sends `If-Match` and an `Idempotency-Key` scoped to document and version,
  so a double submit cannot post twice. Posted and cancelled documents are read-only.
  The dispatch form shows available quantity at the source warehouse per line.
- "Adjust stock" creates an adjustment and posts it. If posting fails, the draft
  remains under Supply operations → Adjustments.
- Supply operations covers returns, dispositions (mandatory damage resolution;
  `SOLD` is never manual), counts (submit resends the draft's lines), adjustments,
  aggregate sales with total-per-item or price-group revenue, payments (verify /
  reject / void via `/status`, allocate to a sales report or obligation, release
  unused allocations), cash handovers (acknowledge receipt), obligations and
  settlements (exactly one verified payment or received handover), closeouts
  (preview, close with available and quarantined counts, reopen with reason,
  revisions), holder custody and administrative reassignment, item price history,
  route crews and members, daily routes, reports, audit events and journal entries.
- Lists load page by page; filters use the `/search` query DSL. Reference fields
  use searchable pickers for holders, items, suppliers, employees, vehicles, crews,
  daily routes, closeouts, payments and handovers. All copy is localized (en/es).

## Remaining limitations

- Custody assignments, item prices and crew members can be added but not edited
  (their PUT routes are not wired yet).
- Sales-report unpaid approvals and closeout "save progress" are not available
  (the latter has no documented endpoint).
- Instant inputs use the browser's timezone and are sent as UTC. Business dates
  are explicit. A company-timezone adapter is still needed across timezones.
- Cash handover payment IDs are entered as a comma-separated list.
- No authenticated end-to-end verification against the live API is included in
  the local checks.

## Validation

```bash
node --experimental-strip-types --test \
  tests/unit/inventory-workflow.test.mjs \
  tests/unit/inventory-swagger-contract.test.mjs \
  tests/unit/inventory-api.test.mjs
npx tsc --noEmit
npm run lint
```
