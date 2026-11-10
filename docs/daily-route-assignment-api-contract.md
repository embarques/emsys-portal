# Daily-route assignment — pending fixes and verification

## Pending fixes and contracts

- Publish the backend unfinished-barcode removal contract, including
  invoice-embedded removal payloads, eligible statuses, delivered-route locks,
  omission versus explicit null, and numeric delivery/trip effects.
- Implement invoice-embedded route removal after verifying the backend contract.
  `patchInvoiceEmbeddedBarcodes` currently accepts only a non-null route and
  applies it only when truthy.
- Define an authoritative route business-date/timezone contract accessible to
  assigned-only crews. The portal uses browser-local dates; the closeout calendar
  requires financial permissions and cannot supply this contract for all crews.
- Define invoice bulk-assignment atomicity, duplicate handling, failure responses
  and replay behavior in the API contract.
- Fix role-change enforcement in pickup authorization. Adding
  `canUpdateAssignedAppointments` appears in `/users/permissions` but owned
  updates still return 403 after token refresh and a fresh sign-in. Removing
  that grant disappears from `/users/permissions` but owned updates still return
  200 and persist changes, including after a fresh sign-in. Adding assigned view
  to an update-only role also leaves list requests returning 403. Determine
  whether cached permissions or persisted role snapshots are stale, invalidate
  all affected authorization state, and verify grant additions/removals agree
  across permission reads and mutation/list gates. Reproduce with
  [the scoped probe](../scripts/test-daily-route-assignment-scoped-api.mjs)
  using `--initial-grants view`, `--initial-grants update`, and
  `--initial-grants assigned --revoke-grant`.

## Remaining verification

- Race actual delivery completion against barcode movement/removal in both commit
  orders. Verify completed status and route attribution cannot be overwritten,
  and invoice-embedded/catalog pieces remain consistent.
- Verify legacy-enabled pickup completion, including pending legacy confirmation,
  missing mappings, concurrent assignment/removal and completion replay.
- Verify foreign-tenant pickup batches reject without changing any eligible
  member or exposing foreign records.
- Verify invoice barcode batches containing completed, missing, foreign-tenant,
  other-branch, invalid-container and duplicate identities. Inspect all selected
  pieces, route membership and trip numbers after rejected requests.
- Complete scoped delivery/invoice authorization and cross-tenant/branch checks.
  Verify concurrent membership-revocation races and permission changes between
  authorization reads and commit. Recheck pickup scopes after the role-change
  enforcement defect is fixed, including grant removal during active requests.
- Verify status-6 CONDUCE and legacy invoice-only pieces can leave old source
  routes through the documented lifecycle. Check catalog/embed synchronization,
  numeric delivery/trip references, old/new manifests, analytics and historical
  attribution after movement and removal.
- Verify actual server business-midnight commit-time behavior, requests already
  in flight, queued writes, browser/server timezone disagreement, clock skew and
  DST transitions. Include additional reads inside invoice patching.
- Verify route/supervisor snapshots remain immutable after source-route edits,
  including historical and legacy data.

## Verification prerequisites

- Establish an approved invoice/delivery fixture lifecycle that does not advance
  existing stale financial periods and accounts for retained signature/audit
  history and independent identity cleanup.
- Use a controllable backend test clock for server-midnight acceptance without
  changing the deployed host clock or weakening authentication.

Related: [daily-route accountability](daily-route-accountability.md),
[delivery completion](delivery-completion-api-contract.md), and
[backend gaps](backend-api-gaps.md).
