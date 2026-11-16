# Daily-route assignment — pending fixes and verification

## Confirmed target model

Daily-route assignment also assigns a delivery/trip and sets CONDUCE. One shared
delivery/trip can contain pieces from several shipping containers. The daily
delivery route is the trip; adding pieces to it does not create another trip.
No separate open-trip selection or start-new-trip action is required within it.
Each piece's original shipping container remains provenance. The user identifies
DEV-RD as the normal returned state. Recommend an atomic Return/unassign action
that clears current route/delivery membership and sets DEV-RD (ID 5); direct
reassignment should replace membership and retain CONDUCE. Do not restore an
arbitrary prior status. Historical assignments and signed receipts must remain
intact. Legacy delivery/trip identity mappings and retry behavior still need a
concrete API contract. This does not make every generic status edit alter routes.

This target supersedes the current per-container trip grouping and preservation
of numeric delivery on route removal as desired behavior; the evidence below
still describes the old implementation. See the
[delivery contract](delivery-completion-api-contract.md) and
[source review](backend-gap-source-review-2026-11-13.md). No API implementation
or identity migration has been performed.

## Latest readback and portal implementation

See the [November 12 read-only recheck](backend-gap-test-sweep-2026-11-12.md)
and [November 11 fixture audit](current-company-api-audit-2026-11-11.md) for
executed tests, retained fixtures and limitations. Catalog unfinished removal,
appointment mixed-batch rollback and same-token assigned grant propagation passed.
The [November 12 Section 3 follow-up](section3-ownership-2026-11-12.md) reran
catalog removal and scoped pickup grants, and established a successful write
control before revoking crew membership. Both read and write access were then
denied. This does not establish in-flight commit-window behavior.
The later [mock-company follow-up](backend-gap-follow-up-2026-11-12.md) passes
91 combined scoped-pickup, protected UPDATE approval and reservation-grant checks.
It verifies rejection, authorized self-approval, stale submission and ordinary
same-token reviewer revocation. The [November 13 pass](backend-gap-follow-up-2026-11-13.md)
now creates completed ordinary invoices through the real branch DTO. Bulk numeric
identity/eligibility remains unresolved despite matched branch/container readback
and an RD-code control. Embedded route removal/catalog synchronization pass, but
missing default/requested statuses block actual CONDUCE/delivered-state coverage
(B16). Pickup results do not certify invoice/delivery authorization or atomicity.
The non-financial `/vehicle-routes/business-date` endpoint works for assigned-only
crews, with optional `branchId`, `businessDate`, `timezone`, `serverTime` and
`nextMidnight`. The portal now consumes it and forwards explicit null through
invoice-embedded patches. The November 12 published Swagger still omits this route.

The backend reports invoice bulk assignment accepts 1–200 distinct positive uint32
piece IDs and is atomic (duplicates 400, missing 404, delivered/conflicts 409).
Successful replay may allocate another trip. The portal validates IDs and disables
assignment mutation retry; the full live invoice matrix remains to be verified.

Remaining acceptance includes live CONDUCE/invoice-only removal and numeric delivery
identity/trip preservation, foreign-tenant batches, delivery completion races,
commit-time midnight/authorization/crew revocation and deployed legacy replay.
Do not treat the older evidence below as a current grant-cache failure.

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
  authorization reads and commit, including grant removal during active requests.
  Separate these races from ordinary same-token grant propagation already verified.
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
