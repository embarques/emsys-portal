# Editing current closeout transactions (API contract)

Status: **portal done, backend behavior unverified.** The published contract
(local `api-docs.json` and live `https://api.embarqueros.com/swagger/doc.json`,
checked November 4, 2026) allows it; a live edit has not been run yet. Verify with
`npm run test:api:backend-gaps -- --bearer --writes` (see
[backend-api-gaps.md](backend-api-gaps.md)).

## Portal behavior

Daily Income offers **Edit** (selection bar, view sheet, edit tab and phone dialog)
only when all of these hold. The same rule lives in
`src/lib/accounting/daily-income/journal-editability.ts`:

- The user holds `canUpdateJournal` (`journal`).
- The journal belongs to the branch's **current open closeout**
  (`GET /income-statements/current`); historical closeouts stay read-only.
- The type is not `INITIAL-PAYMENT` (invoice lifecycle), `INVENTORY` (stock
  movement), `LOAN` (loan APIs) or `VOID`.
- It is not **reconciled** (reconciled is final) and is not reversed or a reversal.

Saving sends `PUT /journals/{id}` with the full entry and the current closeout as
`incomeStatement`. Unchanged values are not sent (`common.form.noChanges`).
`autoClear`/`autoReconcile` are never sent on edit. Delete stays disabled; use a
reversal. Pending Transactions does not offer Edit.

## Published API contract

`PUT /journals/{id}` re-posts the journal with `PostEntryRequest` (same ID) using
the creation payment-account rules. `incomeStatement.id` must reference an open
income statement. `INITIAL-PAYMENT` and `VOID` cannot be updated. Requires journal
update permission. Rejects `autoClear`. Responses: 200, 400, 403, 404, 409.

## Backend confirmations needed

1. An Outstanding journal in today's open closeout can be edited (amount,
   description, account, payment method, assignee) and keeps its ID and closeout.
2. Editing an invoice `PAYMENT` re-applies the invoice balance by the difference.
3. Edits are rejected (4xx, nothing written) for journals in a closed closeout,
   `RECONCILED` journals, reversed journals and reversals. The published contract
   does not mention reconciled or reversed journals.
4. A PUT cannot move a journal into a different closeout.
5. `canUpdateJournal` is seeded and granted only to roles that should edit.
6. Whether `INVENTORY` and `LOAN` journals can be safely re-posted. Until
   confirmed, the portal does not offer Edit for them.
