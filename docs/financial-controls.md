# Financial controls and daily-route approvals

**Deployment verification (November 5, 2026):** the prepared workflow below is
not deployed end to end. Live mock-company probes found change-request routes
missing and the required grants absent. See
[daily-route-permissions-approval-audit.md](daily-route-permissions-approval-audit.md)
for evidence and remaining acceptance tests.

The coordinated API contract is `emsys-api/docs/contracts/financial-controls.md`.
Deploy the API contract before this Portal change, then apply reviewed tenant
permission/index/COA migrations. No production migration is part of this PR.

- Closeouts still require explicit opening with currency/rate. Closed periods
  permit later reconciliation and bank clearance without reopening.
- Reconciliation is internal verification. Bank clearance is independent:
  cash receipts apply immediately; check, Zelle, deposit and card receipts apply
  to invoices only through the atomic journal-clearance command.
- Journal detail uses backend `allowedActions` and versions. Unrestricted edits
  require a version; void retains history. Restricted corrections create a new
  reversal/replacement in the current period. A ledger reversal is not a bank refund.
- Batch results acknowledge only IDs explicitly returned by the API. Omitted IDs
  remain unconfirmed. Retry reuses the original command and request ID; confirmed
  acknowledgements survive subsequent responses. Successful results remain visible.
- `/change-requests` lets daily-route operators submit scoped updates/void requests.
  Source records remain unchanged until approval. Reviewers see safe before/after
  fields and provide a reason. Authorized self-approval is supported. The server
  rechecks requester assignment, current permissions, source version and domain
  rules in one transaction. Private signature content is never a review field.
- New balance-sheet accounts select a permitted immutable master parent and a
  code inside its range. Master layers 1–3 are non-posting and immutable. Existing
  Income/Expense accounts and historical IDs remain intact. Ambiguous legacy
  custom account mappings require review instead of automatic reclassification.

Inventory dispatches retain their existing single-holder ledger model and posted
movement correction rules. This approval workflow does not invent a joint-holder
ledger model or rewrite posted movements.

Dashboard scheduled appointment dates are civil calendar dates; creation timestamps
use the configured business timezone. The API fixes the scheduled weekday/month
aggregation so a UTC date label is not shifted to the previous day.

Validation: production webpack build, TypeScript, ESLint (zero errors), focused
permission/eligibility/outcome unit tests, and a mocked Chromium workflow covering
cross-page selection, method gating, stable retries, incomplete acknowledgements,
and clearance after reconciliation/closure. The complete unit suite retains three
failures also reproduced on unchanged `dev`: two stale Add transaction display
expectations and the old pending-activity section permission expectation.
