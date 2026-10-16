# Supply operations integration

The frontend at `/inventory/workflow` implements the proposed `inventory.md`
workflow independently of the existing `/inventory/items`, receipts, dispatches,
suppliers and Daily Income inventory registration screens. Existing routes remain
in place. Feature code is under `src/lib/inventory/workflow`; the page only composes
its workspace. Server data uses company-scoped TanStack Query keys and the central
Axios instance for Firebase authorization and company context.

## Deployment requirements

Set `NEXT_PUBLIC_INVENTORY_WORKFLOW_ENABLED=true` at build time **only** against an
API implementing the new contract. It defaults to disabled. The API base URL still
supplies the version prefix; endpoint constants intentionally do not repeat it.

The live Swagger documents the new catalog, holders, receipts and dispatches under
`/inventory/...`; those workspace paths now match it. The supply price field is
`defaultSellingPriceMinor`. Most of the remaining workflow endpoints are not
documented, so the deployment flag must remain disabled. See
[inventory Swagger verification](inventory-swagger-verification.md) for the full
comparison and unresolved pagination, stock and permission contracts. No automatic
fallback or legacy payload conversion is performed. This repository does not implement backend ledger transactions,
accounting, permission seeds, route uniqueness, idempotency storage or migrations.

Swagger confirms the permission object shape but not the capability values.
The portal expects permissions represented by its existing `{name, resourceType}`
contract: e.g. `{name: "inventory.read", resourceType: "inventory"}` and
`{name: "closeout.finalize", resourceType: "closeout"}`. The API must grant the new
capabilities explicitly, scope holders, and restrict `closeout.reopen` to authorized
managers/admins. Old delivery/inventory CRUD aliases do not grant the new actions.
The navigation entry requires `inventory.read`; per-resource read/write controls
then use the capabilities from `inventory.md`.

The proposed workspace list contract uses `{data: [], nextCursor}`. Live Swagger
instead declares page-based metadata and no inventory query parameters; cursor
loading and filters remain unverified and must be aligned before enabling. Details and preview
use `{data: {...}, version?}`. The closeout preview must provide `inventoryLines`
with `itemId`, `expectedAvailableEnding`, `expectedQuarantinedEnding`, plus
`financialDifferenceMinor` and a version (inside data or in the envelope). Closing
fails closed if these are unavailable. The API must validate that version and all
count coverage at close time; frontend validation cannot prevent server races.

## Implemented behavior

- Persistent holder selection excludes daily routes. Dispatch source is a warehouse;
  return destination is a warehouse. Current source stock can be inspected in forms.
- Multi-line receipts, dispatches and returns; draft edits with `If-Match`, review,
  posting and draft cancellation where the contract supports it.
- Catalog and price creation, supplier creation, crew membership and dated route
  forms, custody assignment and separately permissioned administrative reassignment.
- Categorized dispositions with mandatory damage resolution; SOLD is never a manual
  disposition. Count submission and explicit signed stock adjustments.
- Aggregate sales with total-per-item or price-group revenue. Price-group quantities
  and totals must match the sale. Amount inputs convert exactly to integer cents.
- Separate mixed-method payment records, manual verification/void, allocations,
  office handover acknowledgements and settlements against outstanding obligations.
- Closeout preview, partial count progress, mandatory available/quarantine counts,
  explained financial differences, review/confirm, fresh preview before close,
  reopen with reason and revision display. Close does not repost source documents.
- Report and audit views, status/date/holder/item/employee filters, paginated lists,
  loading/empty/error states, retries, read-only posted documents and disabled
  pending submissions. Identical failed commands retain their idempotency key while
  the form remains mounted; mutation success invalidates workflow queries.

## Integration details to confirm with the API

The proposal leaves some payload/status details unspecified. Confirm payment
allocation `targetType` (currently `SUPPLY_COLLECTION_OBLIGATION`), handover statuses
(currently `PENDING` / `HANDED_OVER`), crew role values, and custody reassignment
payloads before production acceptance. Actor IDs for audit are always server-owned.

The existing company/API-wide business timezone is not exposed to this feature;
instant inputs use the browser's local timezone and convert to UTC. Business date
is explicit. Configure a company-timezone input adapter before use across timezones.

Current forms use ID inputs for employee, vehicle, route and obligation references
when a dedicated lookup contract is not defined. Holder/item/supplier selects load
paginated options. Supplier contact/address editing, SKU scanning, automatic draft
save, report file export, the cross-module dashboard KPIs, and full Spanish copy
are not implemented in this workspace. Reports and revision snapshots are readable;
there is no dedicated export endpoint in the supplied contract.

Legacy inventory and Daily Income actions are unchanged. The old inventory adapter
still uses single-line payloads and PUT/DELETE, which do not match the new Swagger
models and methods. These paths also need migration. During rollout, remove
legacy write access for users adopting the new ledger so the same activity cannot
be entered through both models. No live backend or Firebase E2E verification is
included in the local checks.

## Validation

`node --experimental-strip-types --test tests/unit/inventory-workflow.test.mjs`
checks multi-line dispatch constraints, exact money conversion, damage resolution,
price-group reconciliation, mandatory counts, quarantine, financial explanations,
and draft/reopen capability configuration. Run `npx tsc --noEmit` and `npm run lint`
as the workspace checks. Execute the seven end-to-end acceptance cases in
`inventory.md` against the deployed API before enabling this workflow for users.
