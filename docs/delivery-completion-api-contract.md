# Delivery completion — remaining gaps

## Route contract decisions

- **Confirmed target:** one delivery/trip may carry pieces from multiple shipping
  containers. The daily delivery route is that trip; further assignment batches
  join it, without separate open-trip selection or new per-batch trip allocation.
  Each piece retains its original shipping container. Assign the
  delivery/trip together with the daily route; unassignment clears that current
  delivery membership and reassignment replaces it. Neither operation changes
  shipping provenance or removes historical receipts.
- For returned pieces, recommend an explicit Return/unassign command that clears
  current membership and sets DEV-RD (ID 5) atomically. Direct reassignment should
  retain CONDUCE. Preserve delivered-piece locks and signed receipts; do not
  implement this as two independently committing portal requests.
- The current API's single-container delivery model and invoice/container-equality
  checks conflict with that target. Propose authoritative piece membership in a
  shared trip, with invoice-scoped completion and signatures. Keep financial,
  actor, company and branch checks; do not simply remove container checks without
  replacing membership validation. Define how legacy delivery IDs and trip numbers
  map to the daily route before changing wire contracts.
- Define and verify invoice-embedded unfinished-barcode removal, numeric
  delivery/trip effects and server business-midnight behavior. See
  [pending assignment semantics](daily-route-assignment-api-contract.md).
- Implement a compatibility/migration contract between daily routes, shared
  trips and legacy numeric delivery references before changing IDs in
  review/completion/signature requests. A container-derived delivery name is a
  naming convention, not a single-container membership restriction. Keep existing
  printed names and history; do not infer a supported endpoint from desired UI.
- **Status catalog:** retain the common core catalog and fixed CONDUCE/delivered
  IDs (6/7) across companies, while allowing extra pre-CONDUCE steps. Define
  transition management and preserve custom steps through seed/upgrade operations.
  Users with a dedicated workflow permission may manage those extra steps;
  branch default-status selection remains administrator-only. The API must
  enforce the distinct capabilities and protect core statuses.

## Completion acceptance

- Verify negative, unavailable/invalid balances and linked uncleared receipts.
- Prove balance/receipt checks participate in the same atomic operation as
  completion when invoice finances change concurrently.
- Verify foreign, duplicate, stale or mismatched embedded/catalog pieces are
  rejected without partial writes.
- Verify policy agreement, collector-owned optional photos, private signature
  storage, metadata-only reads and absence of saved receipts on rejection.
- Verify concurrent UUID replay returns the committed result without duplicate
  receipts or delivery effects.
- Verify assigned-only permissions, revoked crew membership and tenant scope.
  The published completion contract has no uncleared-payment override.

Use [API reference](../.reference/emsys-api/docs/swagger.json) for wire fields and
[backend-api-gaps.md](backend-api-gaps.md) for current backend defects.
