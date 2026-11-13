# Backend gap test sweep — November 11, 2026

Historical snapshot. Latest recheck: [November 12, 2026](backend-gap-test-sweep-2026-11-12.md).

Company: `64d5c0b0d1eab2aaf30b1819`; API: `https://api.embarqueros.com/v1`.
This sweep ran read-only live API checks, all unit/component-browser suites and
an authenticated read-only dashboard sweep. No live API mutations or financial
postings were performed. Remaining ownership is in [backend-api-gaps.md](backend-api-gaps.md).
Full sanitized results are in [the JSON artifact](backend-gap-test-results-2026-11-11.json).

## Executed checks

| Check | Result and limits |
| --- | --- |
| All 20 registered API smoke suites | Initial 17 passed; route probes used stale fields, the activity suite attempted a write-rejection probe, and appointment filters exposed rejected fields |
| Route/activity smoke recheck | Both pass after reusing real portal route constants and honoring read-only mode |
| All directory filter payloads | 1,364 passed, 18 rejected pickup operator combinations, 3 match warnings in the full run |
| Affected appointment filter recheck | 122 passed, 0 failed after hiding four API-rejected controls; unaffected passing table checks reused |
| Candidate capability probes | 245 probes: 173 accepted, 65 explicit field/sort rejections, 4 loan HTTP 500s, and 3 endpoint availability checks |
| Focused live readback | 8 verified, 5 failures, 1 inconclusive; see below |
| Unit suite | 546 passed, 0 failed after correcting three obsolete expectations |
| Full component-browser suite | 238 cases: 186 passed, 50 failed, 2 feature-flag skips |
| Reservation browser recheck | All 15 pass after correcting fixture response/date semantics, search payloads and explicit generation count; 12 failures from the full run resolved |
| Feature-gated bank-expense browser checks | Both default-skipped cases pass with the flag enabled only in mocked fixtures |
| Remaining component-browser failures | 38 from eight files remain unresolved; no claim that the complete browser suite is green |
| Authenticated dashboard sweep | All 23 routes authenticated, no runtime exceptions or failed API reads observed; API writes blocked |
| Static table/schema audit | Failed with metadata/schema drift; detailed lines retained in the JSON artifact |
| Validation | TypeScript and production build passed; ESLint 0 errors / 97 warnings; diff checks passed |

The complete 20-suite and 238-case commands were not repeated after targeted
fixes; passing unaffected cases were reused. Accepted candidate fields establish
syntax support only, not matching, stable ordering, permissions or index quality.
Three full-filter warnings concerned sample-value matching and remain bounded
acceptance limitations. Read-only smoke checks do not certify mutation behavior.

## Verified gaps removed from the pending index

- The real reserved-invoice adapter parses the live flat POST search response;
  the company summary adapter also parses correctly.
- Reserved POST ascending/descending number sorts change the returned order.
  This does not settle all collation/tie cases or the separate GET issue.
- Explicit current-user lowThreshold matches the persisted invoicePoolThreshold.
- Stored user-activity timestamp and check datePosted range controls find records.
- Populated `route.id != null` filters are accepted for pickups and assigned
  delivery barcodes; all three sampled IDs in each result were populated.
- Journal sort candidates are accepted with valid nonempty filters. Invalid
  exploratory empty-group probes were superseded and are not reported as sort bugs.

## Confirmed API follow-up

- PAYMENT status filtering still classifies only 3 of 24,134 rows.
- Reserved GET asc/desc number pages are identical despite distinct sample numbers.
- Loan paidAmount/balance filters and sorts return 500 with valid controls.
- The requested field/sort rejections are listed in the ownership document.
- Published Swagger omits business-date and NOT_REQUIRED and still describes
  clearance as independent. A missing loan-increase schema and GET 404 do not
  establish whether the live POST route exists.
- Earlier independently verified bank settlement failures and retained financial
  attribution repair remain open in the [financial audit](current-company-api-audit-2026-11-11.md).

## Frontend and harness changes made

- The API orchestrator passes credentials through the child environment rather
  than both argv and environment. Parse failures no longer echo the positional value.
- Read-only orchestration also disables invoice assignment/report generation
  and activity write-rejection probes. Route smoke tests
  use the actual feature search/sort constants.
- Inline browser fixture compilation keeps dynamic imports in its one injected
  bundle, fixing Automatic publicPath failures before tests reach the UI.
- Reservation fixtures now model the verified flat search response, reservedAt
  and empty-filter behavior. Tests explicitly enter the amount they assert and
  observe the actual POST search payload instead of obsolete GET query fields.
- Three unit expectations now match the shared Add transaction control and the
  journal permission required by Pending financial activity.
- The portal no longer offers routeNumber, completedBy.name, legacySyncError or
  legacySyncedAt pickup filters while the live API rejects them. Their requested
  backend capability remains tracked; display columns were preserved.

## Authenticated browser scope and environment

The API accepted localhost:3000 but returned empty 403 responses for POST requests
from localhost:3100 and 127.0.0.1 origins. Those failed exploratory sweeps were
superseded by the accepted-origin sweep; they are not permission failures.

The final sweep used the existing dev/test session mechanism with the supplied
valid Firebase JWT. Backend authorization stayed active; no auth code or env
files changed and no browser auth state/traces were exported. The temporary test
server and generated cache were removed, including Next's temporary tsconfig
entries. This verifies authenticated page reads, not Firebase web login,
refresh/logout, transaction submissions or every interactive state. Its timing
includes deliberate settling waits and is not a latency benchmark.

## Why remaining mutation/integration checks were not run

Financial writes stayed paused after the earlier $0.03 attribution problem. A
separate financial test company with supported correction/retirement is needed;
no tenant-provisioning contract/runner is available in this workspace.
No existing customers, invoices, users' grants, shipping work or financial
periods were changed in this sweep.

There is no backend checkout/database fixture runner in this workspace, no
second provisioned tenant, and no controlled deployed legacy-service fixture.
Deterministic commit races, clock changes, database history/index evidence,
notification delivery and full production reconciliation therefore require
backend-controlled integration tests. They remain explicitly unverified,
regardless of the backend team's earlier local-test summary.
