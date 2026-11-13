# Backend gap recheck — November 12, 2026

Later isolated mutation results and updated ownership are in the
[Section 3 follow-up](section3-ownership-2026-11-12.md). The financial behavior
section below describes the earlier read-only run, not that later follow-up.

Company: `64d5c0b0d1eab2aaf30b1819`; API: `https://api.embarqueros.com/v1`.
Comparison baseline: [November 11 sweep](backend-gap-test-sweep-2026-11-11.md).
Current pending ownership: [backend-api-gaps.md](backend-api-gaps.md).
Detailed sanitized evidence: [results JSON](backend-gap-test-results-2026-11-12.json).

## Scope

Reran the complete read-only API smoke suite, candidate filter/sort probes,
readback controls, unit suite, mocked component-browser suite and the two
feature-gated bank-expense UI cases. Also read the complete chart catalog and
exact retained financial fixture records and checked the local test origins.

No live business mutations, financial postings, grant changes or cleanup writes
were performed. Credentials were passed through echo-disabled stdin/environment;
no token was written into this repository. The user's modified api-docs.json was
preserved. No application code, permissions, flags or auth configuration changed.

## Results

| Check | November 12 result |
| --- | --- |
| Registered API smoke suites | **20/20 pass** in one complete run |
| Portal directory filter checks | **1,364 pass, 0 fail, 3 sample-match warnings** |
| Candidate capability matrix | **245 probes: 173 accepted, 65 rejected field/sort candidates, four loan HTTP 500s, three route checks** |
| Candidate comparison | **0 HTTP/status changes** across all 245 baseline probes |
| Readback checks | **8 verified, 5 failed, 1 inconclusive; status outcomes unchanged** |
| Unit suite | **546 pass, 0 fail** |
| Default mocked browser suite | **238 cases: 199 pass, 37 fail, 2 feature-flag skips** |
| Feature-gated bank-expense UI checks | **2/2 pass** with the flag enabled only inside mocked fixtures |
| Static table/schema audit | **21 discrepancies**, unchanged from the baseline |
| Local origins | Valid invoice search returns 200 without Origin and from localhost:3000; localhost:3100 and both tested 127.0.0.1 origins return empty 403 |

All numbers describe this rerun, not a combination of older targeted reruns.
The 65 rejections are deliberate candidate capability tests, separate from the
passing smoke suite that exercises the portal's currently offered requests.
Acceptance alone does not prove data matching, ordering stability, permission
isolation or query/index quality. The three directory warnings concern sample
matching; they were not converted into passes or hidden. Runtime is not a
performance benchmark: concurrency and local test load differ from the baseline.

## Still reproduced

- All 65 candidate field/sort rejections and the four loan paidAmount/balance
  filter/sort 500s. Exact fields and responses are in the results JSON.
- PAYMENT status filtering classifies only **3 of 24,134** rows across
  OUTSTANDING, RECONCILED and NOT_REQUIRED.
- Reserved GET number asc/desc returns the same distinct-number sample;
  POST search sorting changes direction correctly.
- Published Swagger still omits business-date and NOT_REQUIRED and describes
  bank clearance/reconciliation as independent. The business-date GET itself
  remains available. Loan-increase publication/runtime POST remains inconclusive.
- POST /change-requests/search still returns **405**.
- Complete chart readback: **11/11 accounts**, no CASH ON HAND root or selectable
  cash hierarchy; ASSET 4 remains orphaned. This establishes API availability,
  not a direct database inspection.
- All six original/reversal fixture records are still readable. Original SALES
  entries remain REVERSED in branches 12–13; the three -$0.01 reversal entries
  still point to **branch 1 / closeout 32698**. Accounts 21–22, branches 12–13 and
  open fixture closeouts 32699–32700 remain. No repair was attempted.

## Financial behavior not retested

The prior bank settlement failures are **November 11 mutation evidence**, not
new November 12 runtime assertions. Read-only probes and a published description
cannot establish whether the updated implementation now settles/reconciles
atomically, rejects standalone reconciliation, checks the clearance grant, or
applies deferred invoice receipts exactly once.

Those checks remain pending safe financial fixtures and the retained attribution
repair. Discount accounting, financial corrections, loan/inventory postings and
closeout transitions were not submitted to the live company. The corrected bank
fixture runner was not enabled. Existing business periods and records were left
unchanged.

## Frontend comparison

The fresh full mocked browser run reproduces **37** of the prior 38 unresolved
cases. The desktop payment-preview case at 1280px passed without a source change;
this is non-reproduction, not evidence of an API-driven fix. No new failing case
was observed. Remaining counts by file are in the pending index/results JSON.

The two expense cases skipped by default were run separately under the payment
account flag and both passed. No deployed flag was changed. These mocked checks
are not authenticated transaction E2E. The 23 live authenticated dashboard page
reads from November 11 were not rerun; today's authenticated probes exercise the
API/real feature adapters. Full Firebase login, refresh/logout and company-switch
E2E remain pending the appropriate identity/context.

## Documentation updates and limits

- Refreshed the pending index and linked finance, payment-account, assignment
  and retained-fixture documents with current evidence.
- Removed stale supporting-doc claims that ordinary pickup grant changes still
  reproduce the old cache defect; the successful same-token fixture evidence
  remains dated November 11. Commit-time revocation races remain unverified.
- Preserved earlier dated reports as historical snapshots with a latest-recheck
  pointer; neither their mutation evidence nor today's read-only evidence was
  promoted into proof of unexecuted cases.
- Preserved the four ownership sections and all unresolved fixture/database/
  legacy-service/production verification. Deterministic races, backend indexes,
  persisted deletion history, notification delivery and full production analytics
  require backend-controlled fixtures/infrastructure unavailable in this checkout.

Only Markdown and evidence JSON changed in this rerun. Application build/lint
were not repeated for documentation edits. Local links, JSON, secret-pattern and
final diff checks were validated separately. No commits, pushes or deployments.
