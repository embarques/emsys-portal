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

Lifecycle review: bank methods are check, Zelle, deposit, credit card, debit card
and wire. Recording their receipt creates a journal to track pending settlement;
it does not apply the payment to the invoice. Cash requires no bank clearance.

| Action on a bank invoice receipt | Reconciliation | Clearance | Invoice payment |
| --- | --- | --- | --- |
| Record | Outstanding | Outstanding | Not applied |
| Reconcile | Reconciled | Outstanding | Not applied |
| Clear, with or without earlier reconciliation | Reconciled | Cleared | Applied once |
| Void or reverse | Preserve prior verification evidence | Not required | Undo only an applied receipt |

The active offset from a void/reversal requires its own reconciliation and never
bank clearance. A correction posts an offset plus a replacement atomically; a
bank replacement follows the receipt lifecycle above. Retries retain their command
identity, and later verification/clearance does not reopen the original closeout.

The closeout summary now adds live `bankSettlement.pendingCents` and
`bankSettlement.clearedCents` alongside the existing registered totals. These are
income receipts only, in minor units of the response currency using the closeout
rate. Cash, expenses, loans, transfers and inactive originals/offsets are excluded.
The portal labels the two totals in English and Spanish on desktop and mobile;
older APIs that omit the object do not display invented zero balances. Closed
closeouts keep their saved totals while the live settlement breakdown advances.
This adds no portal request and one tenant-local API aggregation. Install the
additive `idx_journals_legacy_income_statement_lookup` index through the normal
API tenant index migration so both supported reference formats remain indexed.
This does not reclassify ledger lines or introduce a bank clearing account.

Local review on November 24, 2026: 55 focused portal unit tests and two lifecycle/
batch browser regressions pass. TypeScript and the production build pass. The API
passes vet, build, the full Go suite, Swagger/Scalar contract checks, and isolated
lifecycle/migration/bank-total fixtures with the race detector. An overlay that
removes the bank eligibility guard reproduces the cash, missing-method, discount
and surcharge action failures. The live bank-total query used one aggregation and
IXSCAN with no COLLSCAN, about 2 ms with 2,012 fixture rows; this adds one summary
aggregation and no portal requests, not a production throughput claim.

The full portal unit suite remains at 714 passing and seven pre-existing failures:
`daily-income-filters`, Add transaction permission gating, four delivery display
cases, and daily-route crew validation. Authenticated acceptance against a deployed
non-production API still needs configured Firebase credentials. No retained-data
migration, permission refresh, deployment, commit or push was performed.

Confirmed policy: recording alone does not finalize a journal. Active, unverified
journals may receive controlled financial edits in the server-selected current
open closeout while reconciliation is OUTSTANDING and clearance is not CLEARED.
Require the explicit update grant, API eligibility, expected-version checks,
before/after audit and atomic financial updates. Pending changes and dedicated
lifecycle restrictions still apply; identity and closeout membership stay intact.
Reconciled, cleared and historical journals require permitted audited reversal/
adjustment or atomic reversal-and-replacement corrections, with the required
grants and reason. Administrators follow the same lifecycle gates. Separately
authorized nonfinancial notes remain audited. The API's `AGENTS.md` and
`CURSOR_RULES.md` now state this policy; this clarification changes no runtime
behavior.

Portal policy follow-up: the shared desktop/mobile guard now requires explicit
OUTSTANDING reconciliation for direct edits and a positive, safe integer version
for generic edits/corrections/cancellations. Generic correction/cancellation also rejects missing or
ineligible reconciliation metadata. The update adapter requires acknowledgment
of the same journal ID; missing or mismatched acknowledgments preserve the draft
and show a localized error. English/Spanish blocked-edit messages direct verified
entries to correction/reversal, never void. No additional requests were added.
The expanded 1280/390 browser fixture verifies direct edits versus independent
reconciled/cleared/historical correction paths, required reason, cancellation,
retry identity and zero writes for incomplete state, pending changes, invalid
versions and denied update/correction permissions. All 57 focused unit tests and
both browser regressions pass. The full portal suite is 716 passing with the same
seven pre-existing failures listed above.

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
older responses. Batch eligibility requires the same payment method only.
Persisted money accounts (`sourceAccount.id`, else `paymentAccount.id`) remain
per-journal metadata for display and settlement; do not invent them from
SALES/AR credits or ledger lines, and do not reject mixed money accounts in one
batch. Legacy edit defaults may still infer their source locally. The portal
does not migrate accounting records.
[API #383](https://github.com/embarques/emsys-api/pull/383) introduced the
same-account constraint; that homogeneity rule is intentionally withdrawn.

Local portal regressions cover initial-payment contracts and mixed-account batch
selection (`tests/unit/initial-payment-contract.test.mjs`,
`tests/unit/journal-reconciliation.test.mjs`, and
`tests/browser/journal-mixed-accounts.test.mjs`). The API follow-up was verified
with Go tests and an isolated MongoDB replica set, including rollback and retry
behavior. Authenticated end-to-end checks against a deployed non-production API
still require Firebase/API credentials.

## Portal lifecycle alignment — API PR #381

The portal presents Edit and Delete while retaining distinct backend commands:

- Edit uses PUT only for an explicitly editable outstanding journal in the
  current open closeout. Verified or historical entries require the API's
  `correct` grant, a reason, and confirmation before one atomic `/correct`
  command reverses the original and posts its replacement in today's period.
- Delete prefers a permitted `/void`, otherwise a permitted `/reverse`; both
  retain the original and an audited offset. Confirmation explains the period
  and that the command does not initiate a refund. No journal DELETE is sent.
- Original and offset leave Pending Clearance (`NOT_REQUIRED`). Only the new
  active offset requires reconciliation (`OUTSTANDING`). Preserve any existing
  reconciliation state, actors and timestamps on the original; otherwise its
  reconciliation becomes `NOT_REQUIRED`. Replacements start their normal
  reconciliation/clearance lifecycle; correction never silently approves them.
- Reconciliation confirms custody; it is not correction authorization. Existing
  change requests and authorized self-approval remain separate. This change adds
  no second-person approval policy or alert-delivery service.
- Identical uncertain corrections retain UUID, reason, version and replacement
  payload within the mounted editor. Failed confirmation retains the draft;
  cancellation returns to the editor without posting. Reload recovery is not
  established. Backend grants, versions, atomicity and domain restrictions remain
  authoritative.

Queue lists, summaries and badges share mandatory server filters: outstanding
queue status and transaction status excluding VOIDED/REVERSED. Clearance also
excludes transaction type REVERSAL; reconciliation includes active offsets. No whole-directory download or detail-per-row lookup is
introduced. Legacy records identified only by reversal/void metadata still
require [API #381](https://github.com/embarques/emsys-api/pull/381)'s explicit
`financial-controls` repair; unsupported metadata filters are not sent by the
portal. The repair must preserve ledger lines, invoice balances and prior audit
actors/timestamps, and safely support reruns. It restores previously excluded
offsets to outstanding reconciliation unless they already have verification
evidence. Already reconciled offsets stay reconciled on reruns. Historical bank receipts without
application evidence stop the seed for review. No production migration,
deployment, seeding or permission refresh is performed by the portal change.

Local acceptance includes command routing, protected/dedicated lifecycle gates,
retry identity, missing acknowledgments, replacement approval flags, server queue
scope and desktop/mobile confirmations. Authenticated acceptance against a
non-production deployed API remains a rollout check; local replica-set tests
cover offset reconciliation, clearance rejection, rollback and migration reruns.

Validation for the confirmed offset-only policy on November 21, 2026: 42
focused unit/permission checks and three Chromium desktop/mobile fixtures pass,
as do TypeScript, the production build and focused lint. API formatting, vet,
build, full tests, regenerated Swagger/Scalar contract checks and race-enabled
isolated lifecycle/migration tests pass. The database fixture records one
aggregation for each clearing-directory history/pending query and one for the
offset reconciliation page. Cancelled receipts remain in history but not pending
counts. Migration reruns after an offset is reconciled preserve that approval.
These are fixture query-count controls, not production latency measurements or a
claimed speed improvement. No production data or deployment was changed.

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

## Loan principal forgiveness (API #382 review)

Principal reduction means forgiveness/loss, never returned funds. The dedicated
`POST /loans/{id}/decreases` command requires journal-create permission, a matching
active actor/loan branch and employee, a current open closeout, and positive
cent-precision amount no greater than the positive outstanding balance. It debits
LOAN PRINCIPAL REDUCTIONS and credits the loan receivable. Paid amount and
cash/bank balances stay unchanged; a zero resulting balance marks the loan PAID.

The API resolves the fixed tenant-local expense account (ID 4000000005); the
portal offers no funding/destination or payment-method input. Existing tenants
must run the chart-accounts seed before activation. A missing or altered loss
account rejects posting. The additive `decreaseRequestId` unique partial index
must also be installed through the standard tenant index migration.

DECREASE loan history and LOAN-DECREASE journals remain distinct from payments.
Closeout expenses include the loss; `nonCashExpenses` keeps that loss from
reducing `totalCash`. No bank clearance item or cash receipt is created.
Reconciliation uses the existing journal confirmation workflow. Generic journal
creation/edit/reversal cannot bypass this dedicated loan lifecycle.

Principal, loan transaction, journal and audit commit atomically. Identical retries
retain their UUID/payload and return the original journal/transaction with the
current loan, including after payoff or closeout closure. Failed/ambiguous
acknowledgments retain the retry identity in the mounted portal session; reload
recovery is not established. Changed payloads require a new command identity.

Local regressions cover cent/balance validation, paid amounts, full forgiveness,
permission and tenant scope, configuration errors, rollback, concurrency and
replay. Portal tests cover payload shape, separate history, desktop/mobile input,
retry identity and focused cache invalidation. Authenticated acceptance against a
deployed non-production API still requires Firebase/API credentials. No historical
journals are rewritten; any records previously posted under a cash-return
interpretation need separate audited review.
