# Verification reports

Updated November 4, 2026, for local work on `feat/eslint-report-fixes`.
The documents distinguish current lint snapshots from historical triage and
previously executed runtime checks. No commit, push, deployment, production API
mutation, or Firebase-authenticated dashboard integration run is recorded here.

## Files

| File | Contents |
| --- | --- |
| [eslint-fixes.md](eslint-fixes.md) | Implementation status and original triage. The numbered findings and line numbers are historical. |
| [eslint-src.json](eslint-src.json) | Refreshed machine-readable `src` lint results after the fixes. |
| [eslint-src.txt](eslint-src.txt) | ESLint's readable formatter output from the same JSON results. |
| [Verification issues](../docs/verification-issues.md) | Open failures, resolved blockers, backend verification limits, and earlier validation history. |

## ESLint results

The refreshed source scan covers **936 files: 0 errors, 87 warnings**.
Before these fixes, the source scan had **161 warnings**. The older 165-warning
count in the verification history included the retired batch-entry code.

| Retained source rule | Warnings |
| --- | ---: |
| `react-hooks/set-state-in-effect` | 70 |
| `react-hooks/incompatible-library` | 6 |
| `react-hooks/preserve-manual-memoization` | 4 |
| `react-hooks/immutability` | 2 |
| `react-hooks/static-components` | 2 |
| `react-hooks/purity` | 1 |
| `react-hooks/refs` | 1 |
| `jsx-a11y/role-supports-aria-props` | 1 |
| **Total** | **87** |

These retained patterns are discussed in section 3 of the triage. They were not
rewritten or globally disabled as part of the fix. Source dependency-array,
unused-variable, and missing combobox-attribute warnings have been addressed.
Intentional reset dependencies and local photo previews have explanatory
suppressions; underscore-prefixed unused parameters/variables are ignored.

The completed full lint run reported **0 errors and 94 warnings**. Its additional
seven warnings were outside `src`:

| File | Rule / finding | Warnings |
| --- | --- | ---: |
| `next.config.js` | Unused `path` | 1 |
| `scripts/probe-barcodes-live.mjs` | Unused `ADVANCED_FIELDS`, `barSearch` | 2 |
| `scripts/probe-invoices-api.mjs` | Unused `collectKeys` | 1 |
| `scripts/probe-pickups-recheck.mjs` | Unused `op` | 1 |
| `tests/browser/fixtures/users-mobile.tsx` | `react-hooks/immutability` | 2 |

`.next-playwright/**` is now excluded alongside `.next/**` in ESLint. It is the
generated build directory configured for Playwright, not application source.
The earlier 627 generated-output errors and associated `ESLintEnvWarning` did not
recur in the completed full lint run. No generated bundles were edited.

Regenerate the JSON snapshot with:

```sh
npx eslint src --format json --output-file reports/eslint-src.json
```

`eslint-src.txt` is generated using ESLint's `stylish` formatter on those same
JSON results, so both files describe one scan. To check the full checkout:

```sh
npm run lint
```

## Runtime validation already completed

| Check | Observed result |
| --- | --- |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed outside the sandbox |
| `npm run test:unit` | 432 passed; Node's existing `MODULE_TYPELESS_PACKAGE_JSON` warning remains |
| `git diff --check` | Passed |
| Four local browser fixture files below | 91 cases exercised; 90 distinct cases passed across the combined run and focused reruns; one baseline failure remains |

The combined browser command was:

```sh
node --test tests/browser/form-enter-navigation.test.mjs tests/browser/searchable-select-enter.test.mjs tests/browser/appointment-form.test.mjs tests/browser/invoice-form.test.mjs
```

That run initially passed **87/91**. A six-case focused rerun passed five,
including the two earlier appointment-layout/invoice-total failures after the
production CSS build finished. The new refetch assertion was adjusted to accept
the existing currency formatting applied on blur. The remaining failure is
listed below. The aggregate **90/91** is not a single clean suite run.

New passing cases verify:

- Desktop and mobile select triggers' `aria-controls` reference the rendered
  cmdk listbox, using its actual generated ID.
- Refreshing payment methods preserves the transaction wizard's active step and
  typed invoice cost without submitting a transaction.

The broader fixture run also exercises comment editing, keyboard navigation,
invoice entry, and transaction steps. It uses mocks; it does not verify live
API authorization, tenant enforcement, financial posting, or Firebase login.
No runtime performance benchmark or speedup is claimed.

## Remaining browser failure

`take/pickup items ask only for quantity and Enter saves; the Other item asks only
for a comment` times out at `tests/browser/appointment-form.test.mjs:115`, waiting
for `Box × 3` inside `Edit purpose 1: Pickup`.

```sh
node --test --test-name-pattern='take/pickup items' tests/browser/appointment-form.test.mjs
```

It reproduces in the working tree and in a temporary copy with the affected form,
select, customer-return hook, and comment-editor source restored to `HEAD`, using
the same fixtures and built CSS. It predates the ESLint fixes; the root cause is
unverified. The temporary comparison did not modify the working tree.

Sandboxed Chromium failed with `bootstrap_check_in ... Permission denied (1100)`;
sandboxed Turbopack failed when starting a process/binding a local port. Browser
fixtures and the production build ran outside the sandbox to complete those
checks. These environment failures are separate from the open fixture failure.
