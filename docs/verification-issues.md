# Verification issues and follow-up

Recorded November 3, 2026, from the validation session on
`feat/batch-transaction-entry`. Batch entry was later removed in favor of the
optimized single-transaction workflow; batch-only results are omitted. This records observed results, not a fresh run
against every subsequent working-tree change. No production API mutations were
performed. Root causes remain unverified unless explicitly stated below.

## Open: browser keyboard regressions

The following command (run with the since-removed batch test included) had
**5 failures**:

```sh
node --test tests/browser/closeout-recovery.test.mjs tests/browser/form-enter-navigation.test.mjs tests/browser/searchable-select-enter.test.mjs
```

All five failures were in
[`tests/browser/searchable-select-enter.test.mjs`](../tests/browser/searchable-select-enter.test.mjs).
The closeout-recovery and standalone form-navigation tests passed.
A comparison against a clean baseline was not performed, so regression origin
is unconfirmed.

| Test | Observed error | What to verify |
| --- | --- | --- |
| `daily income check payment focuses the newly mounted bank and check fields` | `page.waitForFunction: Timeout 5000ms exceeded`; expected focus on `journal-check-number`. | Trace focus through Check selection, bank selection and attempted save; confirm required-field focus reaches the check-number input. |
| `quick invoice entry advances from cost to amount before saving` | Fixture setup timed out waiting for `getByRole('group', { name: 'orders.comments.columns.purpose' }).first()` to become visible. | Check the fixture's readiness selector for quick invoice entry before evaluating cost-to-amount navigation. The navigation assertion was not reached. |
| `Enter saves INVENTORY from review` | Fixture setup timed out waiting for `form`; browser also reported `TypeError: ...useEmployees is not a function` in `RouteEmployeeSelect`. | Verify the mocked employee-hooks module exports the hook required by the inventory form, then verify Enter saves from review. |
| `Enter completes INVENTORY assignment and moves to the next step` | Same missing `useEmployees` export and `form` setup timeout. | Repair/verify the fixture dependency, then check assignment-to-next-step behavior. |
| `Enter completes INVENTORY amounts and moves to the next step` | Same missing `useEmployees` export and `form` setup timeout. | Repair/verify the fixture dependency, then check amounts-to-next-step behavior. |

Focused reproduction:

```sh
node --test --test-name-pattern='daily income check payment|quick invoice entry|INVENTORY' tests/browser/searchable-select-enter.test.mjs
```

Close when these tests pass and any fixture repair is distinguished from an
application behavior fix. Do not weaken form validation to satisfy the tests.

## Open: repository-wide lint errors

`npm run lint` reported **631 errors and 9,509 warnings** in this checkout.
Of the errors, **627 came from generated `.next-playwright` files**. Verify the
lint include/ignore configuration for generated output; do not edit generated
bundles to fix lint.

The other four errors were `@next/next/no-assign-module-variable`:

| File | Reported line |
| --- | --- |
| [`tests/browser/session-transactions-panel.test.mjs`](../tests/browser/session-transactions-panel.test.mjs) | 23 |
| [`tests/unit/order-comment-language.test.mjs`](../tests/unit/order-comment-language.test.mjs) | 10 |
| [`tests/unit/session-transactions-cache.test.mjs`](../tests/unit/session-transactions-cache.test.mjs) | 10 |
| [`tests/unit/session-transactions.test.mjs`](../tests/unit/session-transactions.test.mjs) | 7 |

Verify renaming the local `module` variables and their references without
changing the test loaders' behavior. Re-run the affected tests and lint after
any fix. Line numbers refer to the observed checkout and may move.

To isolate the four test errors:

```sh
npx eslint tests/browser/session-transactions-panel.test.mjs tests/unit/order-comment-language.test.mjs tests/unit/session-transactions-cache.test.mjs tests/unit/session-transactions.test.mjs
```

## Open: non-fatal warnings

- A source-focused lint run (`npx eslint src`) completed with **0 errors and
  165 warnings** (counted while batch entry still existed). Review the individual
  warnings before deciding which require fixes; the source warning inventory was
  not resolved in this task.
- Unit tests emitted Node's `MODULE_TYPELESS_PACKAGE_JSON` warning while loading
  TypeScript modules. Tests passed. Verify the test-loader/module configuration
  before changing the application's package module type.
- Full lint emitted `ESLintEnvWarning` about `/* eslint-env */` in generated
  `.next-playwright` output. Recheck after addressing generated-file lint scope.

## Verify: reconciliation results are not shown per transaction

This is a behavior gap, not an observed API failure. Journal reconciliation currently
submits the selected IDs together, shows an overall error on failure, and clears
the selection/closes the dialog on success.

References:

- [`journal-transactions-table.tsx`](../src/components/accounting/journal-transactions-table.tsx)
- [`reconciliation-api.ts`](../src/lib/accounting/daily-income/reconciliation-api.ts)

The typed reconciliation response contains `data.reconciled: string[]` and
`reconciledAt`; it does not currently define per-ID failure reasons. Verify the
backend's atomic/partial-success behavior and response contract before adding a
per-transaction result display. An omitted ID must not be labeled failed or
successfully reconciled without a documented contract. Any future retry should
preserve confirmed successes and idempotency guarantees.

## Pending backend verification

All backend/API gaps and their live status are tracked in
[`backend-api-gaps.md`](backend-api-gaps.md) (run `npm run test:api:backend-gaps`).
Payment-account work — non-cash expenses, the new-invoice reference default and
duplicate-warning codes — remains in
[`payment-accounts-api-contract.md`](payment-accounts-api-contract.md).

Firebase-authenticated dashboard integration tests were not run. Local fixture
success does not verify live authentication, permissions or API integration.

## Resolved environment blockers and passing checks

- Sandboxed Chromium launch failed with `bootstrap_check_in ... Permission denied
  (1100)`. Running the mocked browser tests outside the sandbox allowed Chromium
  to start. This is not currently an application bug.
- Sandboxed Next.js build failed while creating a process/binding a local port
  (`Operation not permitted`). The production build passed outside the sandbox.
- Production build and `git diff --check` passed at handoff.

Verification status must be updated when an issue is reproduced, fixed or ruled
out; passing checks above do not close the open items automatically.

## Add transaction category follow-up (November 3, 2026)

The chooser now has separate new-invoice and existing-invoice payment categories,
plus inventory entry and the existing inventory dispatch payment flow. The browser
fixture was updated to follow the separate cards instead of changing invoice mode
inside a payment form.

```sh
node --test --test-name-pattern='separate invoice categories|transaction categories fill|changing transaction type' tests/browser/searchable-select-enter.test.mjs
```

Targeted coverage: desktop/mobile invoice registration and payment; nine cards
arranged as 3/3/2/1 on desktop, equal widths within each row and full-width Transfer;
inventory-payment callback and disabled access; employee/payment-method preservation
when changing category. These four targeted checks passed.

An intermediate preservation check failed because a newly focused dropdown shows
an empty search query while retaining its saved employee. The check now closes
the search with Escape before asserting the committed selection, and passes.
This is resolved; it is not an outstanding employee-data-loss report.

TypeScript and production build passed during this change. Focused lint reported
zero errors and five warnings in the existing wizard effect/dependency code.
The earlier five browser failures listed above were not re-run or closed by this
focused category validation. Live inventory permissions/navigation still need
Firebase-authenticated integration verification; the local test uses a callback
fixture and does not post reconciliation payments.

## Grouped loan actions follow-up (November 3, 2026)

The chooser now has 11 cards in Invoices, Income & expenses, Inventory, Loans,
and Account transfers. Invoice adjustment labels are Apply invoice discount and
Apply invoice surcharge. New loan and Loan payment open the existing dedicated
loan dialogs and APIs; neither posts through the generic journal form.

Validation passed:

- Four grouped chooser/invoice browser checks: group labels, equal-width cards,
  full-width Transfer, both loan callbacks, denied-action state, desktop/mobile
  invoice flows, and preservation of shared fields.
- Two existing create-loan browser checks: validation, review, failure retention,
  duplicate submission prevention, closeout gating and phone layout.
- `node --test tests/browser/loan-entry.test.mjs`: the real entry controller and
  dialogs call the correct mocked create/payment mutations; payment failure
  preserves input and a successful retry closes the dialog.
- Seven loan-allocation and employee-branch unit checks; TypeScript; production
  build; and `git diff --check`.
- Focused lint: no errors; the existing wizard effect/dependency warnings remain.
  The new controller, dialog wrapper and loan-entry fixture lint cleanly.

An initial loan-entry fixture run failed with `Cannot read properties of undefined
(reading 'post')` because its relative hook import escaped the test's API mock.
The mock boundary was corrected and the controller test passed. This was a
resolved fixture wiring error, not an observed live loan API failure.

Still verify in an authenticated non-production environment:

- The authoritative loan read/create/payment permission contract. The current
  registry has no dedicated loan grants; the new entry actions inherit Add
  transaction's journal-create and income-statement-view guards. Do not invent
  dedicated grant names without an API contract.
- Real loan creation, payment allocation and resulting closeout entries through
  the existing loan APIs, including an employee with more active loans than the
  inherited bounded lookup page. No live API mutation was performed here.

The earlier unrelated browser/lint issues remain open unless separately verified.

## Latest chooser layout (November 3, 2026)

The latest layout request supersedes the separate two-column group sections:
all 11 cards now form desktop rows of **3/3/3/2**. Type ordering is retained and
each card displays its group label. The final two cards share the width equally;
a single remaining card would fill its row. Mobile cards remain stacked.

The focused grouped-chooser browser check passed with actual row count/width
assertions and payment-action/permission checks. TypeScript, focused lint and
`git diff --check` passed. No new failures were observed in this layout change.

## Compact transaction card labels (November 3, 2026)

Category labels moved to the right of the icon on desktop and into a separate,
right-aligned column on phone cards. Action titles and descriptions no longer
include a category line. The 3/3/3/2 layout, action callbacks and permission states
remain intact. The focused chooser browser check, TypeScript, focused lint and
`git diff --check` passed; no new failures were observed.
