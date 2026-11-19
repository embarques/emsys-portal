# Financial controls — remaining gaps

Current backend defects are listed in [backend-api-gaps.md](backend-api-gaps.md).
Latest read-only evidence: [November 12 recheck](backend-gap-test-sweep-2026-11-12.md).
Later mutation evidence: [Section 3 ownership](section3-ownership-2026-11-12.md).
Current portal/runtime follow-up: [portal verification](section3-portal-verification-2026-11-12.md).
The wire contract is [API reference](../.reference/emsys-api/docs/swagger.json); business meaning belongs
in [APP_CONTEXT.md](../APP_CONTEXT.md).

Latest live results: [November 13 verification](backend-gap-follow-up-2026-11-13.md).
Independent-key commands racing for one receipt now produce one success and one
409 and apply exactly once. Same-key, mixed/missing batch, CASH receipt/discount
and closeout-total controls pass. Failed-write rollback and post-period settlement
remain. Tested B10 funding references reject; classification trust is separately
B15. A real persisted EXPENSE positive control confirms the latter defect.
The journal createdAt-desc list now passes a bounded ordering check. Swagger
publication and historical PAYMENT migration remain incomplete.

## Confirmed policy — November 14, 2026

Reconciliation confirms internal receipt and does not clear a payment or apply a
deferred bank invoice receipt. Clearance records actual payment posting and
atomically reconciles as well, applying eligible receipts exactly once. Preserve
earlier reconciliation actor/time when subsequently clearing. An uncleared bank
receipt may be internally reconciled; earlier API/portal rejection controls reflect
a superseded rule and must be updated under V02.

Closeouts limit new transaction entry to a day and provide operational summaries.
Existing transactions can reconcile/clear after that day closes without moving
periods or reopening it. Registered amounts stay with the original day; status
breakdowns may update with clear labels and audit history. Do not require a frozen
accounting-period snapshot or duplicate income merely for clearance. This is a
confirmed target, not a claim that implementation/deployment already matches.

## Invoice registration — API PRs #384 and #383

[API #384](https://github.com/embarques/emsys-api/pull/384) keeps collected money
and the invoice discount on one `INITIAL-PAYMENT`. Send the gross invoice cost,
the discount and the collected amount in that single command; do not generate
separate `PAYMENT` and `DISCOUNT` commands. For a $100 invoice with $80 collected
and a $20 discount, income/net collected is $80 and operational expenses are $0.
Unpaid registration sends amount zero without a payment method or destination;
the API omits the zero receipt line. The discount still reduces receivables.

Use returned `paymentAccount` to label receipts, with ledger-line fallback for
older responses. For batch eligibility under
[API #383](https://github.com/embarques/emsys-api/pull/383), use persisted
`sourceAccount.id`, else `paymentAccount.id`, else zero, alongside the payment
method. Do not invent source metadata from SALES/AR credits or infer a batch key
from ledger lines. Legacy edit defaults may still infer their source locally.
Older rows without money-account metadata therefore stay separate from new rows
with a known destination; the portal does not migrate accounting records.

Local portal regression coverage: `tests/unit/initial-payment-contract.test.mjs`.
Backend Go tests and authenticated registration/clearance checks still need to
run in an environment with Go and non-production Firebase/API credentials.

## Journal lifecycle and migration

- Verify payment-method/account corrections and remaining lifecycle concurrency.
- Verify broader concurrent/lifecycle PAYMENT queue behavior. New outstanding,
  settled and reversed detail/filter consistency and basic pending-count changes
  are established. Historical migration is required only when existing production data must be retained;
  disposable mock rows can be reset/reseeded instead. Any retained-data migration
  must preserve invoice balances and support safe reruns.
- Verify edits cannot move entries between closeouts; prove
  closed/reconciled/cleared/reversed rejection or audited correction behavior,
  with complete rollback of invoice balances, queues and totals.
- Verify atomic bank clearance/reconciliation after period closure,
  mixed/ineligible batches, concurrent commands, retry identity and immutable
  audit evidence. Establish any employee/branch/method aggregation contract
  before adding grouped totals.

## Permissions and approval workflow

- Verify remaining permission combinations, inventory journal autoReconcile
  with an accepted create control, and tenant/branch scope.
- Owned pickup UPDATE submission/replay/rejection, authorized self-approval,
  repeat-review conflict, pending-source direct-write lock, stale-version
  submission and same-token reviewer revocation now pass with disposable actors.
  Cover other resources/actions and commit-time changes separately.
- Verify remaining inventory grant combinations and
  in-flight grant and crew-membership revocation at commit. Ordinary assigned
  pickup additions/removals, reconciliation grant addition/removal and clearance grant removal/restoration passed the
  November 12 same-token checks; they are
  not a currently reproduced cache defect. See
  [assignment acceptance](daily-route-assignment-api-contract.md).
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
