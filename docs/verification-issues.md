# Verification issues and follow-up

Updated November 4, 2026, following the ESLint fixes on
`feat/eslint-report-fixes`. Earlier entries were recorded November 3 from the validation session on
`feat/batch-transaction-entry`. Batch entry was later removed in favor of the
optimized single-transaction workflow; batch-only results are omitted. This records observed results, not a fresh run
against every subsequent working-tree change. No production API mutations were
performed. Root causes remain unverified unless explicitly stated below.

**Current status (November 4, 2026, uncommitted working tree):**

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | Pass |
| `npm run test:unit` | 432/432 pass |
| `npm run test:keyboard` | 73/73 pass |
| `npm run lint` | 0 errors, 94 warnings (was 631 errors, 9,509 warnings) |
| `npx eslint src` | 0 errors, 87 warnings (was 165) |
| All browser tests (`tests/browser/*.test.mjs`, one file at a time) | 20 failures in 6 files, all pre-existing; see below |

## Open: pre-existing browser test failures (November 4, 2026)

A full browser run found failures outside the keyboard suite. The same tests
fail on a clean checkout of the last commit (`dcb24318`), so today's changes did
not cause them (the clean checkout had one extra `appointment-form` failure).
`invoice-form.test.mjs` failed only when all files ran in parallel; run alone
it passes 11/11. Run files one at a time; parallel runs hit 5s timeouts.

| File | Failing | First observed error | What to verify |
| --- | --- | --- | --- |
| `appointment-form.test.mjs` | 1/4 | Waits for button `Edit purpose 1: Pickup` containing `Box × 3`. | See [pickup-comment browser fixture failure](#open-pickup-comment-browser-fixture-failure-november-4-2026). |
| `deliver-dialog.test.mjs` | 9/32 | Payment and Cuadre tests time out waiting for `#journal-amount`. | How the delivery balance-review payment form now mounts (step order or field id). |
| `invoice-documents.test.mjs` | 3/7 | `input[type="file"]` matches 2 elements (strict mode); wizard auto-complete assertions fail. | Which component now renders a second file input; then the auto-complete assertions. |
| `journal-reconciliation.test.mjs` | 1/1 | Checkbox `Select TXN-A1` never appears (30s timeout). | Row selection label in the journal transactions table. |
| `pending-inventory.test.mjs` | 4/4 | `Truck 3` text never appears. | Holder/vehicle display in the pending dispatch list and its fixture data. |
| `pending-transactions.test.mjs` | 2/2 | Cross-page selection assertion; `$100.00` missing from `Selected transactions`. | Selection summary rendering and fixture totals. |

Close each row by distinguishing a stale test/fixture from an application
regression. Do not weaken permissions or validation to make them pass.

```sh
PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" node --test tests/browser/deliver-dialog.test.mjs
```

## Invoice permission alignment (November 4, 2026)

The portal now gates invoice actions on the dedicated grants: Add invoice and
the quick action on `canCreateInvoice`; Edit (directory, view sheet,
double-click, and Barcode Manager's invoice-edit shortcuts) on
`canUpdateInvoice`; Delete on `canDeleteInvoice`. `canCreateAssignedInvoice`
alone gets the assigned flow. `canGenerateOwnInvoicePool` is not used yet and is
tracked in [`backend-api-gaps.md`](backend-api-gaps.md).

Verified: `tests/unit/invoice-permissions.test.mjs`, TypeScript and lint.
Still verify with real roles in an authenticated non-production environment:
a role with `canViewInvoice` but not `canCreateInvoice` sees no create entry
points, and a `canCreateAssignedInvoice`-only user gets the assigned flow.

## Resolved: browser keyboard regressions (November 4, 2026)

The five failures in
[`tests/browser/searchable-select-enter.test.mjs`](../tests/browser/searchable-select-enter.test.mjs)
were test fixtures that had fallen behind the forms. No application code or
form validation changed. `npm run test:keyboard` now passes 73/73.

| Test | Cause | Fix (test-only) |
| --- | --- | --- |
| `daily income check payment focuses the newly mounted bank and check fields` | Passed on re-run; no change needed. | — |
| `quick invoice entry advances from cost to amount before saving` | The comments-editor readiness wait ran for every `quickEntry` fixture; the test still used the removed auto-number checkbox; a discount field now sits between cost and amount. | Readiness wait scoped to `kind === "comments"`; selects `#journal-invoice-number-mode-custom`; Enter goes cost → discount → amount. |
| `Enter saves INVENTORY from review` | Mocked employee hooks lacked `useEmployees`/`useEmployeeSearch` (`RouteEmployeeSelect` crashed); ready data had no holder, which dispatched inventory now requires. | Added both hooks to `fixtures/inventory-hooks.ts`; ready data includes `inventoryHolderEmployees`. |
| `Enter completes INVENTORY assignment and moves to the next step` | Same as above. | Same. |
| `Enter completes INVENTORY amounts and moves to the next step` | Same missing hooks. | Same. |

The full suite also exposed `Enter completes INITIAL-PAYMENT payment and moves
to the next step` (already failing before this fix): new invoices now have a
Customers (`parties`) step after Payment, so the test expects `parties`.

Run locally with the installed Playwright browsers:

```sh
PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" npm run test:keyboard
```

## Resolved: repository-wide lint errors (November 4, 2026)

The earlier full lint run reported **631 errors and 9,509 warnings**, including
627 errors from generated `.next-playwright` bundles. That configured Playwright
build directory is now excluded in [`eslint.config.mjs`](../eslint.config.mjs).
Generated bundles were not edited.

The other four errors were `@next/next/no-assign-module-variable` in the test
loaders of `tests/browser/session-transactions-panel.test.mjs`,
`tests/unit/order-comment-language.test.mjs`,
`tests/unit/session-transactions-cache.test.mjs` and
`tests/unit/session-transactions.test.mjs`. Their local `module` variables were
renamed to `loadedModule`; the `"module"` parameter passed to transpiled code is
unchanged. Focused lint and their tests passed.

Re-running those checks exposed a stale session-panel assertion: it expected
128px below the panel, but the October 16 layout change removed `xl:pb-32` on
purpose. The test now expects the panel flush with the grid (0px).

Latest full `npm run lint`: **0 errors, 94 warnings**. Source warnings decreased
from **161 before this fix to 87**; the earlier 165-warning count included the
retired batch-entry code. No source dependency-array, unused-variable, or missing
combobox-attribute warnings remain. The fixes and retained warnings are recorded
in [`reports/eslint-fixes.md`](../reports/eslint-fixes.md); current source snapshots
are [`eslint-src.txt`](../reports/eslint-src.txt) and
[`eslint-src.json`](../reports/eslint-src.json).

## Open: retained non-fatal warnings

- **87 source ESLint warnings** remain intentionally in scope for later review:
  70 `set-state-in-effect`, six `incompatible-library`, four
  `preserve-manual-memoization`, two `immutability`, two `static-components`,
  and one each of `purity`, `refs`, and `role-supports-aria-props`.
  Rule severity was not lowered to remove these warnings.
- The other **seven full-lint warnings** are in `next.config.js`, three probe
  scripts, and `tests/browser/fixtures/users-mobile.tsx`. See the
  [report index](../reports/README.md) for the breakdown.
- Unit tests still emit Node's `MODULE_TYPELESS_PACKAGE_JSON` warning when loading
  TypeScript. All 432 tests passed. Verify loader/module configuration before
  changing the application's package module type.
- The generated-output `ESLintEnvWarning` did not recur in the completed full lint
  run after `.next-playwright` was excluded.

## Open: pickup-comment browser fixture failure (November 4, 2026)

`take/pickup items ask only for quantity and Enter saves; the Other item asks only
for a comment` in
[`appointment-form.test.mjs`](../tests/browser/appointment-form.test.mjs)
times out at line 115 while waiting for `Box × 3` inside the
`Edit purpose 1: Pickup` button. It fails in the working tree and in a temporary
copy using the original source for the affected forms, selects, and comment
editor. This establishes that the failure predates the ESLint fixes; its root
cause remains unverified. Do not treat it as a passing fixture or a confirmed
live API issue.

Reproduce with the installed Playwright browser:

```sh
node --test --test-name-pattern='take/pickup items' tests/browser/appointment-form.test.mjs
```

The combined fixture run exercised 91 cases across Enter navigation, searchable
selects, appointment forms, and invoice forms. It initially passed 87 and failed
four. Focused reruns passed the appointment layout and invoice-total Enter cases
after the production CSS build completed; the new refetch assertion was corrected
to allow the existing currency formatting on blur. Across those runs, **90
distinct cases passed and this one remains failing**; this is not a claim that a
single 91-case run passed.

New passing regressions verify that desktop/mobile select triggers reference the
actual cmdk listbox ID and that payment-method refetches preserve the transaction
wizard's step and typed amount. The source fixes retain immediate comment-handler
ref updates and the wizard's intentional reset boundaries.

Validation for the ESLint fixes also passed `npx tsc --noEmit`, `npm run build`,
`npm run test:unit` (**432/432**), and `git diff --check`. These are local checks;
no commit, push, deployment, live API mutation, or Firebase-authenticated
integration validation was performed. Full commands and scope are in the
[report index](../reports/README.md).

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
- Browser tests run from the agent shell failed with `browserType.launch:
  Executable doesn't exist` because `PLAYWRIGHT_BROWSERS_PATH` pointed at an
  empty sandbox cache. Prefix runs with
  `PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright"` to use the
  installed browsers.

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
focused category validation (they were closed November 4; see
[browser keyboard regressions](#resolved-browser-keyboard-regressions-november-4-2026)). Live inventory permissions/navigation still need
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
