# Section 3 — portal verification and remaining API work

November 12, 2026. Company `64d5c0b0d1eab2aaf30b1819`, API
`https://api.embarqueros.com/v1`. This follows the earlier
[ownership pass](section3-ownership-2026-11-12.md).

Later live API results supersede the remaining-work column below where stated:
[mock-company follow-up](backend-gap-follow-up-2026-11-12.md). CASH V01, ordinary
concurrent/mixed bank controls, inventory valuation/revisions and bounded
reservation controls have since been exercised. B10, B12 and B13 still reproduce.

Section 3 was not exclusively backend-owned. Portal checks found and fixed
problems in rollover recovery, retry identity, clearance follow-up, cache
refresh and pending-payment messaging. The remaining index now describes live
API assertions, with completed portal checks removed. Many remaining assertions
can still be invoked through a portal/API client; deterministic database and
clock/commit-window checks need backend instrumentation.

## Portal changes

- The transaction wizard now forwards CLOSEOUT_REQUIRED to its form. Previously
  it swallowed the error, preventing rollover setup even though the standalone
  form supported recovery. The rendered wizard preserves the draft and retries
  after setup; an unrelated rejected save also releases submission state and
  accepts corrected input without opening a closeout.
- Daily Income and delivery payments use `/journals/sync`. An uncertain response
  keeps the same user/company/payload-bound UUID for retry, overlapping identical
  submissions share one posting, and a successful subsequent entry gets a fresh
  UUID. Corrected payloads and explicit duplicate overrides get separate IDs.
  The sync adapter preserves the ordinary create approval flags and rejects an
  unconfirmed success without losing retry identity. IDs are retained in the
  mounted session, not persisted across a browser reload.
- Pending Clearance no longer sends standalone reconciliation after clearance.
  The backend now performs both atomically. It refreshes affected invoice detail,
  journals, lists, balances and closeout totals, as well as the pending queues.
  A rendered cache check confirms that an unrelated invoice detail stays cached.
- Delivery bank receipts display pending until clearance is confirmed. An
  uncleared receipt never permits delivery or offers a liability override.
- A new invoice-line draft gets its own editor identity, fixing Enter committing
  an item while focus remained in the previous total field.

These changes preserve default-off bank clearance, explicit permissions,
captured update versions, duplicate-payment confirmation and server-authoritative
delivery balances. No auth bypass, deployment flag or backend source changed.

## Live results

| Check | Result |
| --- | --- |
| Isolated receipt/sync/permission/count suite | **72 passed, 0 failed** |
| Real portal customer create/address/conflict adapters and cleanup | **8 passed, 0 failed** |
| Missing/stale invoice delete versions with unchanged saved-state readback | **2 passed, 0 failed** |
| Ordinary invoice creation/completion fixture | **Blocked by B13**; final suite 19 passed / 2 failures from that branch rejection |
| Loan increase via the real portal adapter | Deployed POST router explicitly returns **404 Route not found**; B12 |

[Receipt evidence](section3-portal-live-evidence-2026-11-12.json) records:

- Bank sync auto-clear/replay succeeds with the clearance grant and without
  reconciliation permission.
- Pending method/account correction preserves the selected bank and keeps the
  invoice receipt deferred. Clearing changes paid to 80/balance to 0; repeating
  the command does not apply it again. Duplicate IDs are rejected.
- New outstanding and settled PAYMENT detail/filter counts agree. The real
  portal pending-count adapter includes the new payment and excludes it after
  clearance. Reversed-state filters were established in the earlier readback.
- The same Firebase token is denied reconciliation, succeeds immediately after
  the fixture role receives the grant, and is denied after its removal.
- The $20 discount debits SALES DISCOUNTS as CONTRA-REVENUE and credits receivables.
  The selected $20 discount/$80 bank receipt summary is income 80, expenses 0,
  net 80. This is not proof of the CASH-funded variant or every report total.

[Customer/loan evidence](section3-customer-loan-evidence-2026-11-12.json) confirms
that the actual address-only payload omits name/phones, the address persists,
a genuine duplicate-identity change returns 409, and the rejected customer stays
unchanged. Both created customers were removed.
[Version evidence](section3-invoice-version-evidence-2026-11-12.json) confirms that
missing and stale versions cannot delete the exact retained audit fixture.

[Invoice fixture evidence](section3-invoice-boundary-evidence-2026-11-12.json)
captures the documented branch DTO, matching persisted actor branch, current
date and HTTP 400 "Invoice branch is required". This reproduces with full grants
and also blocks completing an unpaid registration. We did not substitute guessed
branch aliases or mutate an existing shipment to get a passing result. Its pending
invoice was deleted with the current version; its registration journal remains
readable. Live 200-piece, CONDUCE and attached-document scenarios did not execute.

## Coverage by original ID

| ID | Portal/client behavior verified | Remaining live API work |
| --- | --- | --- |
| V01 | Cash picker ancestry/defaults, expense funding payloads, money/balance calculations; bank discount/receipt accounting also verified live | CASH hierarchy B02 and full cash-funded closeout/report totals |
| V02 | Pending bank messaging, no delivery override, stable clearance retry and targeted cache refresh; live method/account correction and replay | Mixed/concurrent commands, injected settlement failure and closed-period transitions |
| V03 | Rendered rejected-save recovery, NY/RD rollover and preserved draft; lost committed-response replay with one posting, overlap guard, payload/actor/company separation | Browser-reload recovery is outside the in-memory session guarantee; dependent-write crash atomicity belongs to backend integration |
| V04 | Increase schema requires positive amount/loan; exact source-account payload and disabled-by-default feature gate; loan create/payment browser recovery | B12: deploy/publish the missing increase route, then verify real loan lifecycle invariants |
| V05 | Cash ancestry, method/account switching, selected funding payloads, zero/false semantics and expense schemas | Persisted-account enforcement B10; inactive/nonposting/protected-account and sync/update/expense matrix |
| V06 | 200 numeric IDs use one scoped business-clock read and one mutation; malformed, duplicate and oversize batches produce no HTTP requests | Valid invoice fixtures blocked by B13; foreign/delivered/missing inputs and atomic persisted outcomes remain |
| V07 | Explicit null versus omission, revision-bound embedded patches, unchanged delivery fields and delivered-item guards | Live catalog/embed/CONDUCE/legacy synchronization and trip/manifests after B13; completion races |
| V08 | Captured delete version, no refresh-before-save, attached-document conflict propagation without retry; document upload/retry browser behavior | Attached-document deletion denial after B13 and full historical audit coverage |
| V09 | Address-only payload excludes identity, keeps captured version and reloads full customer; live edit/conflict/cleanup passed | A seeded legacy duplicate identity and linked-history case |
| V10 | Assigned-only gates, supplied customer/assignment constraints and explicit receivedBy payload variants; invoice form browser coverage | Real assigned-invoice ownership/revocation/replay and branch-specific controls |
| V11 | Negative/unavailable balances fail closed; pending bank payments cannot override delivery; balances rechecked before completion; policies/photo retries and duplicate-submit protection | Backend enforcement against tampering, other actors' photos and assignment/concurrency races |
| V12 | Quantity/money/valuation/closeout schemas and API payloads; rendered inventory validation, required income/credit/loss notes, one command under overlapping submit and stable retry ID | Database valuation/rollback/reopen and broader autoReconcile/grant combinations |
| V13 | Server business-day/closeout reason parsing, current-period selection, stale-clock guards; rendered NY/RD rollover preserves and retries the draft | Real clock-controlled midnight and period-boundary mutation behavior |
| V14 | Reservation operation IDs, uncertainty/conflict handling, typed zero/false filters, remote sorting/date display, user lookup and selection behavior | Cross-company/branch cursor binding, stable sort ties and server date semantics |
| V15 | Local permission gates/cache scopes; same-token reconciliation grant changes verified live | Other approval combinations, multiple real tenants and commit-time revocation |
| V16 | Outstanding/settled/reversed PAYMENT filters, live pending count delta and rendered clearance cache invalidation | Historic migration is optional for discarded mock data; broader production concurrency remains backend integration |

## Local checks

- Focused browser run: **89 passed, 0 failed** across invoice forms/documents,
  customer address editing, reservations, loan create/payment, delivery,
  reconciliation, inventory and rollover recovery. This uses real components
  with controlled API boundaries, not Firebase login or a deployed UI.
- Retry session: six focused regressions pass, including a durable mock commit
  followed by response loss. Invoice bulk/delete boundaries: three pass.
- Existing stale browser expectations were corrected to the current contract:
  no bank-payment delivery override, manual closeout setup, current confirmation
  wording/required fields and current queue controls. Missing fixture API exports
  were supplied. Product rules were not relaxed to make these cases pass.

The previously referenced `section3-portal-results-2026-11-12.json` is absent from
this checkout; no unavailable historical type/lint/build results are claimed
from that artifact. The later follow-up above records its own executed checks.

## Scope and retention

Only tagged mock fixtures were written. Grant changes affected temporary roles,
and all created tenant/Firebase identities were independently removed. The
retained registrations, periods and immutable financial evidence are listed in
[mock-data follow-up](mock-data-follow-up.md). No credentials were persisted.
The user's modified api-docs.json and unrelated working-tree changes were preserved.
No commit, push or deployment was performed.

This is neither full production sign-off nor proof of transaction rollback from
client mocks. The separate Firebase login/logout/refresh/company-switch check
and deterministic backend fault/clock instrumentation remain prerequisites for
those specific claims.
