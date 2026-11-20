# Payment accounts — remaining gaps

Latest execution: [November 13 verification](backend-gap-follow-up-2026-11-13.md).
The tested B10 funding-reference defects now reject on SALES create/sync/update
and EXPENSE source paths. Rejected updates preserve version/account/ledger;
selected CASH expense, CASH defaults and canonical bank metadata pass. Broader
inactive/non-posting/cross-company/protected-account/allocation coverage remains.

A separate classification defect remains B15: an EXPENSE can debit persisted
ASSET account 5 when the client calls it Gasolina/EXPENSE. The final test uses a
real branch-local EXPENSE category as its positive control and records the
forged category separately. Resolve all consumed posting references from storage.

Earlier cash receipt/discount/closeout totals remain established; the November 13
pass repeats API totals without generating another public PDF. See
[backend gaps](backend-api-gaps.md) for exact remaining contracts.

## Cash and bank account acceptance

- Verify cash child creation/allocation against the current template contract.
  Creating an ASSET child under root 1 without a code returned "funding account
  code must be four digits within its account range" in this run. No guessed
  range/code was submitted. Existing visible child 10004 and root 1 replace the
  earlier missing-root/orphan-ASSET-4 finding; root posting now passes.
- Verify chosen cash posting/readback for PAYMENT, SALES and INITIAL-PAYMENT
  on create/sync/update, including omitted-account defaults and sync replay.
- Verify cash expenses credit a valid selected cash source and preserve it on read.
- Cover inactive, non-posting, nonexistent, spoofed, cross-company and cross-branch
  accounts, plus deep ancestry, on each applicable create/sync/update path.
- Verify occupied codes, exhausted ranges, concurrent allocation and
  wrong-parent rejection.
- Verify BANK type/deletion protection, allowed parents, cycles and report roll-ups.

## Deferred invoice receipts

Credit-card receipts preserve processor clearing. `INITIAL-PAYMENT`, `PAYMENT`,
`SALES` and `REFUND` omit `paymentAccount` on card writes and consume the API's
`CARD PROCESSOR RECEIVABLE` metadata on read. The UI and schemas do not require
a bank selection for these receipts. Stale bank selections are discarded by the
payload adapter. `requiresBankAccountSelection` controls account selection;
`requiresBankAccount` retains bank-method settlement classification. This keeps
card receipts outstanding until clearance and preserves explicit clearance grants
and user consent. Card-paid expenses continue funding from `sourceAccount` BANK.

Local regressions: `tests/unit/credit-card-processor.test.mjs` and
`tests/browser/card-processor.test.mjs`. Live processor settlement and real MongoDB
clearance/replay remain separate acceptance checks.

- Verify method/account corrections adjust only the correct invoice
  receipt effect, with no double application, cross-closeout movement or partial
  write. Cover concurrency, failed settlement and replay across lifecycle states.
- Confirm feature-flag enablement and live catalog IDs are safe for every affected
  client before enabling selected cash accounts broadly.
