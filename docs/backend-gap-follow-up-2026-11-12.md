# Mock-company backend gap follow-up — November 12, 2026

Company `64d5c0b0d1eab2aaf30b1819`; API `https://api.embarqueros.com/v1`.
This later execution supersedes the corresponding pending claims in the earlier
[sweep](backend-gap-test-sweep-2026-11-12.md) and
[portal pass](section3-portal-verification-2026-11-12.md). The current remaining
index is [backend-api-gaps.md](backend-api-gaps.md).

## Backend fix status

| ID | Verified outcome |
| --- | --- |
| B02 | Resolved for current API visibility/posting. CASH ON HAND is persisted ASSET 1, child 10004 references it, and the cash-funded receipt posts correctly. Account 4 is now SALES/REVENUE rather than the earlier orphan ASSET. Historical mapping preservation is still I04. |
| B05 | Still open: published business-date/NOT_REQUIRED/atomic-clearance descriptions remain stale. Runtime settlement passes despite the stale description. |
| B06 | Still open: four paidAmount/balance filter/sort probes return HTTP 500. |
| B07 | Still open: reserved GET asc/desc return the same sample; POST search direction changes. |
| B08 | Still open: POST /change-requests/search returns 405. |
| B09 | All 65 earlier unsupported field/sort candidates remain rejected. Acceptance of the other 173 candidates establishes request support only. |
| B10 | Still open and broader: nonexistent/wrong-branch BANK IDs persist on SALES create/sync; journal update persists a nonexistent ID. EXPENSE rejects both invalid sources with a valid-source positive control; spoofed BANK-to-ASSET input is rejected. |
| B11 | Still open: the bounded createdAt-desc journal query returns HTTP 400 wrapping MongoDB QueryExceededMemoryLimitNoDiskUseAllowed, not a documented unsupported sort. |
| B12 | Still open: actual portal increase POST against an independently established absent loan returns 404 Route not found. No valid increase can be certified. |
| B13 | Still open: ordinary create and unpaid-registration completion reject the documented branch despite persisted actor branch/current period/full grants. No 200-piece/document/delivery fixture was manufactured around the rejection. |
| B14 | Newly explicit: valid receivedAt reservation filtering returns HTTP 400 because the field is not allowed. reservedAt is a different timestamp. |

See [account/query responses](backend-gap-accounts-recheck-2026-11-12.json),
[245 capability probes](backend-gap-readiness-recheck-2026-11-12.json),
[readback controls](backend-gap-readback-recheck-2026-11-12.json),
[invoice prerequisite](section3-invoice-recheck-2026-11-12.json) and
[customer/loan responses](section3-customer-loan-recheck-2026-11-12.json).
No backend source or deployment was changed in this frontend checkout.

## Section 3 execution

| ID | New evidence and remaining boundary |
| --- | --- |
| V01 | Complete for the isolated $100 invoice / $20 discount / $80 CASH collection: selected persisted root receives the debit; invoice balance is zero; whole-closeout income/net/cash is 80 and expenses zero; discount is separately 20. PDF extraction confirms invoiced 100, income/cash 80, expenses zero and separate discount. |
| V02 | Concurrent identical UUID commands both succeed and apply $30 once. A fresh already-cleared command returns 409 while a pending $50 command succeeds; final paid/balance is 80/20. Missing-ID and mixed-method batches leave the valid journal/invoice unchanged. Changed payload under a reused UUID returns 409. Independently keyed commands racing for the same pending receipt, injected failure and closed-period transitions remain. |
| V05 | Explicit cash receipt, omitted-account CASH create/sync ledger defaults, valid bank expense, invalid expense sources and spoofed type rejection pass. Invalid SALES create/sync/update are B10. Inactive/nonposting/cross-company/protected-type and child-allocation matrices remain. |
| V06–V08 | B13 still blocks valid invoice-piece fixtures. Bulk rollback/replay, CONDUCE/embed/catalog synchronization, delivered locks and attached-document history were not executed. Earlier missing/stale delete-version checks remain separate evidence. |
| V09 | Real customer create/address/conflict/unchanged-state adapters and cleanup pass again (8 checks). Legacy duplicate identities with linked history cannot be created by ordinary validated duplicate writes; seeded legacy coverage remains. |
| V10–V11 | Assigned invoice and delivery policy/photo/balance enforcement require valid completed fixtures; B13 blocks this runner. Pickup results do not stand in for invoice/delivery results. |
| V12 | 15 checks pass: receipts at two costs, 20 units/$15 valuation, negative-count rejection with unchanged closeout version/status, matching close, identical replay, reason-required reopen, reclose and preserved prior revision snapshots. Injected failures, other dispositions and broader permission/autoReconcile combinations remain. |
| V13 | Manual financial close remains disabled (409). Clock-controlled stale/latest-closed/midnight transitions remain unverified; no old business period was changed. |
| V14 | Stable repeated GET IDs, non-overlapping cursor advance, stable repeated createdAt-desc search with real timestamp ties, and invalid reservedAt rejection pass. Disposable actor GET/search deny missing view grants, accept grant addition and deny removal with the same token. receivedAt support fails (B14). Changed-filter cursor reuse is accepted with no matches; filter/tenant binding, generate/assign/return grants and business-day boundaries remain. |
| V15 | Combined assigned-pickup/approval/pool suite passes 91/91. Owned UPDATE submission/replay leaves source unchanged; missing reviewer is denied; rejection leaves source unchanged; explicit reviewer/management grants allow self-approval; repeated review returns 409. Pending changes lock direct edits even for admin, stale captured versions reject new submissions, and reviewer removal applies with the same token. Other resources/actions and cross-company isolation remain. |

V03/V04/V16 were already removed from the pending table after the earlier portal
checks. This execution does not imply browser-reload retry persistence, a working
loan increase, or historical PAYMENT-status migration. The readback still finds
incomplete historical status coverage; new-fixture status and badge checks pass.

## Evidence and validation

Machine-readable run summary: [results](section3-follow-up-results-2026-11-12.json).

- [Final cash/concurrency/account matrix](section3-matrix-final-evidence-2026-11-12.json):
  **94 passed / 5 failed**, all five failures are invalid SALES account acceptance.
- [Cash PDF text and assertions](section3-cash-report-evidence-2026-11-12.json):
  all five expected totals/discount checks pass. Only the isolated fixture
  closeout was reported. The user explicitly approved the temporary public PDF
  generation/download after automatic approval review rejected that step.
- [Bank regression](section3-bank-recheck-2026-11-12.json): **139 passed / 2 failed**,
  invalid nonexistent/wrong-branch account creation. The negative controls now
  discover a real other-branch BANK rather than assuming account ID 1 is a bank.
- [Inventory lifecycle](section3-inventory-evidence-2026-11-12.json): **15 passed / 0 failed**.
- [Scoped approval and pool grants](section3-approval-evidence-2026-11-12.json):
  **91 passed / 0 failed**. Separate approval readiness: **16 passed / 1 failed**;
  the sampled labels target returns 403 without an owned positive control, so
  defect ownership remains unassigned. No pre-existing request was reviewed.
- [Reservation controls](section3-reservation-evidence-2026-11-12.json): **4 passed / 1 failed**,
  unsupported receivedAt. This is outside the earlier 245-candidate matrix.
- Readback controls: **8 verified / 5 failed / 1 inconclusive**. Candidate matrix:
  **173 accepted / 65 rejected / 4 loan HTTP 500 / 3 route probes**.
- Unit suite: **555 passed / 0 failed**. Script syntax and focused ESLint passed.
  No frontend runtime source changed in this follow-up; browser, type and
  application build checks were not rerun or claimed from earlier artifacts.
- Complete read-only API smoke run: **20/20 suites passed**, no retries.
  Wall time 764.2 seconds; directory filter suite 735.2 seconds. These are
  execution timings, not comparable performance benchmarks or improvement claims.

Earlier matrix iterations are retained as raw execution evidence:
[initial iteration](section3-matrix-initial-evidence-2026-11-12.json) includes two
redundant reversals of already-reversed journals; the
[next iteration](section3-matrix-evidence-2026-11-12.json) includes two overly
strict omitted-paymentAccount assertions. Saved ledger lines correctly debit
CASH ON HAND; the final runner permits the absent optional reference and still
requires the correct debit. These harness failures are not backend defects.
An earlier setup-only branch was retained after cash-child creation rejected
an omitted code; no undocumented code/range was guessed.

The [initial approval iteration](section3-approval-initial-evidence-2026-11-12.json)
incorrectly expected a direct source edit during a pending change. Its 409 is
the enforced pending-source lock, not a backend defect. The owned pending request
was rejected and its pickup removed in an
[independent cleanup](section3-approval-cleanup-evidence-2026-11-12.json).
A [first complete approval run](section3-approval-first-complete-evidence-2026-11-12.json)
passed 81 checks; the final run adds reservation GET/search view-grant checks.
All retained change requests are owned fixture audit records, not pending work.

## Retention and limits

Only tagged mock records and disposable identities were mutated. Original
business periods, users and grants were preserved. Financial fixture postings
were reversed in their own branch, temporary identities removed, and immutable
registration/reversal history retained. The inventory item and supplier were
deactivated; its isolated 20 units and holder/receipt/closeout history remain.
Exact retention is listed in [mock-data follow-up](mock-data-follow-up.md).

No credential was saved in the repository. Public report URLs are omitted from
the saved evidence. No commit, push or deployment occurred. Database fault
injection, commit-time revocation, clock control, direct historical migration
verification and a second authorized company remain outside this execution.
