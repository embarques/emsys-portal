# Section 3 ownership — November 12, 2026

Later portal changes, additional live outcomes and current verification coverage
are recorded in the [portal follow-up](section3-portal-verification-2026-11-12.md).
The remaining-work table below describes this earlier pass.

Company `64d5c0b0d1eab2aaf30b1819`, API `https://api.embarqueros.com/v1`.
This follows the earlier [read-only sweep](backend-gap-test-sweep-2026-11-12.md).
Only tagged mock fixtures and temporary identities were mutated. Existing user
grants and business closeouts were not changed.

## Findings and ownership

| Finding | Owner / disposition |
| --- | --- |
| Bank clearance now sets CLEARED and RECONCILED; standalone bank reconciliation returns 409; autoClear works without canReconcileJournal | Updated backend behavior confirmed; removed B01 from the pending index |
| Portal separately attempted reconciliation after successful bank clearance, or returned stale OUTSTANDING without that grant | Frontend fixed: trust confirmed atomic clearance, remove the redundant reconciliation request and grant dependency |
| SALES accepts bank ID 2147483646 although account lookup returns 404; saved ledger debits that nonexistent ID | Backend B10: resolve and validate persisted account before posting |
| Branch-15 actor posts SALES to bank 1 belonging to branch 1; saved ledger retains bank 1 | Backend B10: enforce account scope independently of supplied name/type |
| Bounded journal createdAt-desc list returns aggregation memory-limit error, reproduced twice | Backend B11: query/index capacity or explicit unsupported-sort response |
| New $100 invoice, $20 discount, $80 deferred bank receipt, manual clearance/replay and automatic clearance | Passed through isolated fixtures; contra-revenue ledger and selected-entry net-income summary are correct |
| New settled PAYMENT filtered by OUTSTANDING, RECONCILED and NOT_REQUIRED | Correct 0/1/0 results for the selected journal, matching detail |
| Same Firebase token after removing/restoring canClearJournal | Immediate 403 / successful clearance; no token refresh needed |
| Assigned pickup grant and crew removal | Passed with a positive write control restored before crew removal; this is not proof of in-flight commit safety |

The portal change preserves clearance off by default and the existing explicit
clear-on-save choice. Failure after journal creation still returns the saved
journal rather than retrying creation. For successful explicit clearance, the
checked request sequence is create → clear, previously create → clear → reconcile
when the actor held reconciliation permission. This removes one HTTP request in
that path; no latency or throughput improvement is claimed.

## Section 3 coverage and remaining work

| ID | Established here | Still open / next ownership decision |
| --- | --- | --- |
| V01 | Discount debits SALES DISCOUNTS (CONTRA-REVENUE) and credits ACCOUNTS RECEIVABLE; selected discount/payment summary is income 80, expenses 0, net 80 | Actual CASH-funded variant and full closeout/report totals require valid cash hierarchy (B02). Bank collection does not prove cash-on-hand behavior |
| V02 | Invoice paid remains zero and balance 80 before clearance; manual clearance changes paid to 80/balance 0; same command replay preserves them. Automatic settlement likewise applies once | Method/account correction, duplicate/mixed batches, concurrent commands, failure injection and post-period settlement |
| V03 | Negative amount rejected; subsequent valid posting succeeds. /journals/sync replay returns the same journal ID | Rendered-form rejected-save recovery, dropped response/retry identity, dependent-write rollback and concurrency |
| V04 | No new loan posting executed in this follow-up | Exercise actual portal increase payload against an isolated loan; establish deployment and lifecycle/grants before labeling a backend defect |
| V05 | Valid branch bank persists; nonexistent and wrong-branch accounts incorrectly persist | Backend creation defects confirmed. Sync/update/expense/default/inactive/nonposting/spoof/cross-company matrix remains |
| V06 | No new invoice bulk fixture executed here | Invoice piece 1–200, duplicate/missing/foreign/delivered, rollback and replay matrix; do not substitute appointment batches |
| V07 | Catalog unfinished removal/movement, explicit null versus omission, old-source removal and rejected past destination all pass | Invoice-embedded/CONDUCE synchronization, delivery ID/trip preservation, delivered locks and completion races |
| V08 | Posted journal DELETE rejected 409; reversals retain own branch/closeout and remove pending statuses | Invoice version/document/linked-history deletion behavior remains unverified here |
| V09 | Not executed here | Tagged legacy duplicate-identity/address/history fixtures still needed; do not infer frontend ownership from a rejected request alone |
| V10 | Pickup assigned-scope controls passed; this is not an invoice-scope result | Assigned invoice ownership/customers/receivedBy/branch-11 matrix remains |
| V11 | Uncleared bank receipt does not reduce invoice balance | Delivery balance/photo/policy/crew negatives and concurrent completion remain |
| V12 | Not executed here | Inventory valuation/reopen/failure/permission matrix remains; existing inventory evidence is separate |
| V13 | Each financial actor opened its own new current closeout | Real rollover, stale/latest-closed and draft recovery require dedicated fixtures and a controllable clock for deterministic coverage |
| V14 | No new reservation fixture executed here | Permissions, tenant/branch/cursor binding, stable ties and date semantics remain |
| V15 | Clearance grant removal/restoration takes effect with identical token; pickup grant and membership removal pass | Reconciliation-specific grants, other permission combinations and cross-company isolation remain |
| V16 | Settled and reversed new PAYMENT detail and three status-filter results agree | Outstanding filter coverage and badge counts across context/lifecycle remain; historical mock cleanup is optional |

Remaining scenarios are unverified work, not a declaration that the backend is
broken. HTTP requests can establish persisted outcomes and ordinary authorization
changes. Deterministic failures between database writes, commit-window races and
clock-controlled midnight transitions need backend integration instrumentation.

## Evidence and validation

- [Financial fixtures](section3-financial-evidence-2026-11-12.json): 81 passed
  checks, two genuine account-validation failures and one invoice-setup failure.
- [Receipt fixtures](section3-receipt-evidence-2026-11-12.json): final run
  48 passed, zero failures. Includes raw registration, invoice snapshots,
  discount ledger and selected-entry summary (80/0/80).
- [Saved-state readback](section3-readback-evidence-2026-11-12.json): confirms
  invalid account postings, account scope, memory error and first-run reversal
  attribution; seven checks pass, including six reversed-PAYMENT status-filter
  checks. First bank run's three inline reversal-branch assertions were
  harness errors: creation responses omit branch; saved records contain it.
  All three belong to branch 14 / closeout 32701.
- Catalog route lifecycle: 26 passed, zero failures; all catalog/route fixtures
  deleted. Scoped pickup permissions: 49 passed, zero failures; tenant fixtures,
  generated customers and Firebase identity removed.
- Unit suite: 546 passed; focused journal suite: 17 passed. TypeScript noEmit
  and focused ESLint passed. Production build passed after lifting the sandbox's
  local-port restriction for the Turbopack CSS worker. Existing broader browser failures from the earlier
  sweep were not rerun or claimed fixed.

Initial plain-invoice setup attempts failed validation/permission checks and
were not counted as backend defects. The successful receipt flow used the real
portal's zero-payment registration adapter instead. One initial invoice balance
assertion treated an omitted zero payment as nonzero; the final check uses the
API's omitted-zero semantics and records before/after snapshots.

No credentials were written to these artifacts. No commit, push or deployment
was performed. Retained financial mock records and incomplete setup periods are
listed in [mock-data follow-up](mock-data-follow-up.md).
