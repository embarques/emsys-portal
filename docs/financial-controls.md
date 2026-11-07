# Financial controls — remaining gaps

Current backend defects are listed in [backend-api-gaps.md](backend-api-gaps.md).
The wire contract is [api-docs.json](../api-docs.json); business meaning belongs
in [APP_CONTEXT.md](../APP_CONTEXT.md).

## Journal lifecycle and migration

- Verify payment-method/account corrections and remaining lifecycle concurrency.
- Historical reconciliation/filter coverage is still incomplete in the tested
  tenant: 24,132 PAYMENT rows, only 3 matching OUTSTANDING and none RECONCILED;
  one OUTSTANDING readback disappears under its matching status filter. Confirm
  execution of the backend's reported evidence-based backfill, review ambiguous
  rows and verify safe reruns without changing invoice balances.
- Verify edits cannot move entries between closeouts; prove
  closed/reconciled/cleared/reversed rejection or audited correction behavior,
  with complete rollback of invoice balances, queues and totals.
- Verify reconciliation and clearance independently after period closure,
  mixed/ineligible batches, concurrent commands, retry identity and immutable
  audit evidence. Establish any employee/branch/method aggregation contract
  before adding grouped totals.

## Permissions and approval workflow

- Verify remaining permission combinations, inventory journal autoReconcile
  with an accepted create control, and tenant/branch scope.
- Establish grant-change/cache refresh behavior: a fresh role edit exposed the
  reconciliation grant through `/users/permissions`, while the command still
  returned 403 with the same token.
- Verify `/change-requests` end to end with assigned employee, supervisor and
  authorized management identities. Route/schema presence does not certify policy.
- For pickup, invoice, journal, barcode and inventory-dispatch targets, verify
  create/read/request_update/request_void/review/update/void independently.
- Prove assignment isolation across list/search/detail/write, including revoked
  assignments and changed IDs, filters, pages, company and branch headers.
- Submission/rejection must leave the source unchanged. Approval must recheck
  current grants, assignment and source version and commit source/request/audit
  changes atomically; test authorized self-approval and denied reviewers.
- Verify protected direct writes remain denied with legacy grants, closed-period
  corrections do not reopen history, concurrent approval applies once, and
  injected failures roll back every dependent change.
- Confirm target identifiers, version formats, permitted update fields and action
  metadata match the client. The current editor is not a general editor for all
  fields or inventory document types.

## Chart of accounts

- Verify permitted master parents, immutable layers, posting eligibility,
  occupied codes, range exhaustion, concurrent allocation and protected types.
- Review ambiguous legacy custom-account mappings before migration; verify
  existing Income/Expense IDs and historical postings remain intact.
